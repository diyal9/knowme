# 库存预留函数静态审查

以下全部基于题面 M1–M4 合成夹具推演，未访问任何仓库、数据库或工具；所有"失败时序""测试设计"均为静态分析产物，不是实测回执。

## 1. 原实现的决定性失败时序

### 缺陷 A：检查与扣减非原子（超卖 / 幂等账本错乱）

`getRequest → getStock → setStock → putRequest` 四步之间可被另一进程穿插（M2 明确"多个调用间可被其他进程穿插"）。用 M4 数据构造反例：

**A-1 超卖（双读 5）**
```
进程1: getRequest(A,r1)=∅   getStock(A,P)=5
进程2: getRequest(A,r2)=∅   getStock(A,P)=5        ← 读到同一旧值
进程1: setStock(A,P,1)      putRequest(A,r1,{remaining:1})
进程2: setStock(A,P,2)      putRequest(A,r2,{remaining:2})   ← 后写覆盖前写
结果: 库存=2，但实际售出 7 > 5；且 r2 返回 remaining:2 是错误值。
```
更糟的交错：进程2 先 `putRequest(r2)`，进程1 后 `putRequest(r1)` 抛唯一键冲突——该异常按契约"原样向上抛出"，r1 明明库存够却收到非业务错误，而库存已被进程2 扣掉，r1 无账本记录。

**A-2 幽灵重放（扣减成功、账本失败）**
```
进程1: getStock=5 → setStock(A,P,1) 成功 → putRequest 抛冲突/崩溃
后续同 requestId 的重放请求: getRequest=∅ → 再次从 1 起扣 → 重复扣减。
```
违反"成功扣减与请求账本必须一起提交"。

**A-3 部分回滚残留**
若把 setStock 放事务外、putRequest 放事务内（或反之），回调异常只回滚事务内的写入，事务外的 setStock 残留。

### 缺陷 B：完全不做 qty 校验

契约要求 qty 为正安全整数否则抛 `INVALID_QTY` 且不改变任何状态。原函数直接 `stock < qty` 比较：
- `qty=-3`：`5 < -3` 为 false → 通过 → `setStock(8)`，库存凭空增加；
- `qty=1.5`：通过 → 写入非整数库存；
- `qty=2**53`：越过 MAX_SAFE_INTEGER；
- `qty=NaN`：`5 < NaN` 为 false → 通过 → `setStock(NaN)` 污染库存。

**关键反例（B + A 组合）**：负 qty 绕过 `OUT_OF_STOCK` 检查后，还可能在事务版本里以"合法请求"身份占用 requestId，导致后续同键正 qty 重放被判 `IDEMPOTENCY_CONFLICT`。

### 缺陷 C：重放未按 sku/qty 比对

`if (old) return old.result;` —— 同 tenant+requestId、不同 sku 或 qty 的重放会静默返回首次结果，违反 `IDEMPOTENCY_CONFLICT` 要求。

### 缺陷 D：租户外泄漏风险

`db.getStock(tenant,sku)` 等顶层方法本身带 tenant 参数，看似隔离，但正确做法是把整个"读请求账本→读库存→写库存→写账本"序列放进 `db.tx(tenant, ...)`，由同租户串行化保证跨租户独立（M2）。原实现根本没用 tx，谈不上租户边界，但需说明：**仅靠 tx 包裹不够**，见下节。

## 2. 修正代码（最小完整变更）

```js
async function reserve(db, { tenant, sku, requestId, qty }) {
  // B: 前置校验，任何读写发生之前完成，失败不触碰库存/账本
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isSafeInteger(qty)) {
    throw new Error('INVALID_QTY');
  }

  // 整体放入同租户事务：串行化覆盖"尚不存在的请求键"（M2），
  // 扣减与账本要么一起提交、要么一起回滚（解决 A-2/A-3）
  return db.tx(tenant, async (tx) => {
    const old = await tx.getRequest(tenant, requestId);
    if (old) {
      // C: 重放必须比对 sku/qty
      if (old.sku !== sku || old.qty !== qty) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return old.result; // 原结果，不再扣减
    }

    const stock = await tx.getStock(tenant, sku); // 不存在视为 0
    if (stock < qty) throw new Error('OUT_OF_STOCK'); // 回滚，不占用 requestId

    const remaining = stock - qty;
    await tx.setStock(tenant, sku, remaining);
    const result = { remaining };
    await tx.putRequest(tenant, requestId, { sku, qty, result });
    return result;
  });
}
```

要点：
- **校验在 tx 之外**：`INVALID_QTY` 路径零次数据库调用，天然满足"不改变库存/请求账本"。
- **`OUT_OF_STOCK` 通过抛异常触发回滚**：即使先写了什么也会回滚；这里顺序是先检查后写，回滚只是兜底。
- **超时语义**：断连可能发生在提交前或提交后，调用方拿到同一个数据库超时。两种情况下的收敛行为都正确——提交前：什么都没发生，重试走全新路径；提交后：账本已落库，重试命中 `old` 分支返回原结果。这正是"调用方事后可用相同 requestId 再次请求"的依据，无需引入新 API。

## 3. 为什么常见较小改法不够

| 改法 | 遗漏 |
|---|---|
| 只加 qty 校验（C 的最小版） | 超卖 A-1、幽灵重放 A-2 原样存在 |
| 只把四步包进 `db.tx` 但不比对 sku/qty | 冲突检测缺失：`{sku:P,qty:4}` 之后 `{sku:P,qty:99}` 同键重放会静默返回 `{remaining:1}`，等于允许用旧结果"确认"一笔从未扣过的量 |
| 保留顶层调用、只在 `putRequest` 冲突后重读再返回 | 冲突后重读到的记录若属于并发中的另一笔不同参数请求，无法区分"真重放"与"参数漂移"；且 setStock 已在事务外落库，回滚不掉——需要补偿逻辑，复杂度反而更高，仍不满足"一起提交" |
| 用 `putRequest` 先行占位、成功后再扣库存 | 占位后扣减失败要删占位记录，删除与扣减之间又出现新的穿插窗口；且 `OUT_OF_STOCK` 要求"不占用 requestId"，占位方案违约 |
| 乐观 CAS（读-改-写重试循环） | M2 没有提供 compare-and-set API，发明它违反"不引入新数据库 API"；即便模拟重试，扣减与账本仍是两次独立提交，A-2 依旧成立 |

核心：只有**同租户事务串行化 + 事务内先查账本再扣减 + 参数比对**三者同时在场，才覆盖全部决定性时序。

## 4. 定向测试设计（受控初态 / 操作 / 可观察结果）

标注 **[推演]**：按 M2 契约的逻辑必然性；**[待实测]**：需在真实工程环境验证。

### T1 基础正确性 [推演]
| # | 初态 | 操作 | 期望 |
|---|---|---|---|
| 1.1 | A/P=5 | reserve(A,P,r1,4) | `{remaining:1}`；stock=1；A/r1 记录存在 |
| 1.2 | 同上 | 同参数重放 r1 | 返回 `{remaining:1}`，stock 仍 1，账本无第二条 |
| 1.3 | A/P=5 | reserve(A,P,r1,-3) / 1.5 / 0 / 2**53 / NaN | 均抛 `INVALID_QTY`，getStock/getRequest 与初态逐字节一致 |
| 1.4 | A/P=2 | reserve(A,P,r9,3) | 抛 `OUT_OF_STOCK`；`getRequest(A,r9)=undefined` |
| 1.5 | A/P 不存在 | reserve(A,P,r1,1) | 视为 0 → `OUT_OF_STOCK` |

### T2 幂等冲突 [推演]
- 2.1：A/r1 已成功 `{P,4}`；再发 `{Q,4}` 同键 → `IDEMPOTENCY_CONFLICT`，stock(Q) 不变。
- 2.2：A/r1 已成功 `{P,4}`；再发 `{P,5}` → `IDEMPOTENCY_CONFLICT`。
- 2.3：A/r3 `{P,4}` 成功；B/r3 `{P,4}` → 独立成功（跨租户同名 requestId 合法）。

### T3 并发决定性反例（复现 M4）[推演，需真实引擎实测]
- 3.1 **双读 5**：A/P=5，两进程分别执行 r1(4)、r2(3)。串行化后必为某一顺序，例如 r1 先：r1→`{remaining:1}`，r2 在事务内读到 stock=1 → `OUT_OF_STOCK`；反向顺序则 r2 成功 `{remaining:2}`、r1 `OUT_OF_STOCK`。**不变量：任意交错下最终 stock ≥ 0 且 stock = 5 − Σ成功扣减**。
- 3.2 **同名跨租户并发**：A/r3 与 B/r3 各 `{P,4}` 同时发起，两事务分属不同租户，互不阻塞，均成功。
- 3.3 **同键同参并发**：两进程同时发 A/r1 `{P,4}`，A/P=5。一个成功 `{remaining:1}`，另一个在事务内命中 `old` 分支返回同一 `{remaining:1}`；总扣减恰为 4。

### T4 故障注入 [待实测]
- 4.1 事务提交前杀连接 → 超时；重试同 requestId → 全新成功路径，stock 只扣一次。
- 4.2 提交后 ack 丢失 → 超时；重试 → 命中账本返回原结果，**不得**二次扣减。这是"全有或全无 + 相同 requestId 可重放"契约的核心验收点。
- 4.3 `tx` 回调内部对 `setStock` 注入抛错 → 回滚后 `getRequest` 无记录、stock 不变。

### T5 现有测试缺口 [推演]
M4 提到现有测试只覆盖"顺序成功扣一件"。至少缺：T1.3 非法 qty 五变体、T2 冲突、T3 全部并发交错、T4 提交前后断连。建议把 T3 做成参数化交错测试（固定 seed 的调度
