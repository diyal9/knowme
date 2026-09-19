## 1. 原实现的决定性失败时序

原代码在 `getStock`、`setStock`、`putRequest` 之间没有事务保护，存在**超卖**和**幂等账本不一致**两类致命缺陷。

### 反例 A：并发超卖（库存守恒破坏）
- **初态**：Tenant=A, SKU=P, Stock=5；请求 r1(qty=4)、r2(qty=3) 同时到达两个进程。
- **时序**：
  1. P1: `getRequest(A,r1)` → undefined
  2. P2: `getRequest(A,r2)` → undefined
  3. P1: `getStock(A,P)` → 5
  4. P2: `getStock(A,P)` → 5 （穿插读取）
  5. P1: `setStock(A,P, 1)`
  6. P2: `setStock(A,P, 2)` ← **覆盖写入，实际剩余应为 -2 但被写为 2**
  7. P1/P2: `putRequest` 均成功
- **结果**：总扣减 7 > 初始 5，且最终库存 2 与业务事实不符。违反“不能超卖”及“数量守恒”。

### 反例 B：提交后断连导致状态分裂
- **初态**：Tenant=A, SKU=P, Stock=5；请求 r1(qty=4)。
- **时序**：
  1. P1: `getStock` → 5
  2. P1: `setStock(A,P,1)` ✅ 已持久化
  3. P1: `putRequest(...)` ❌ 网络超时/断连，调用方收到 Error
- **重试时**：
  1. P1: `getRequest(A,r1)` → undefined （因为 putRequest 未成功）
  2. P1: `getStock(A,P)` → 1
  3. P1: `setStock(A,P, -3)` ← **二次扣减，库存变负或错误**
- **结果**：同一 requestId 造成两次扣减，违反幂等契约。

### 为什么常见较小改法不够？
- **仅加唯一键冲突捕获**：只解决重复插入，不解决读-改-写竞态（反例 A）。
- **仅用 `db.tx` 包裹但保留外部 `getRequest`**：事务内仍需先查再判，若查询在事务外则仍有 TOCTOU 窗口；若在事务内但未处理 `IDEMPOTENCY_CONFLICT` 分支，重放会误抛异常而非返回原结果。
- **跨租户共用事务**：M2 明确 `db.tx(tenant,...)` 按租户隔离，不能合并 A/B 操作。

---

## 2. 最小完整修正代码

```javascript
async function reserve(db, { tenant, sku, requestId, qty }) {
  // 1. 参数校验（保持接口兼容）
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error('INVALID_QTY');
  }

  return db.tx(tenant, async (tx) => {
    // 2. 幂等检查：必须在事务内，保证读+判断+写入原子性
    const existing = await tx.getRequest(tenant, requestId);
    if (existing) {
      if (existing.sku !== sku || existing.qty !== qty) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return existing.result; // 同键同参重放，返回首次结果
    }

    // 3. 库存检查与扣减：在同一事务串行化区间内完成
    const stock = await tx.getStock(tenant, sku);
    if (stock < qty) {
      throw new Error('OUT_OF_STOCK');
    }

    const remaining = stock - qty;
    await tx.setStock(tenant, sku, remaining);

    const result = { remaining };

    // 4. 写入请求账本：与 setStock 同属一个事务，全有或全无
    try {
      await tx.putRequest(tenant, requestId, { sku, qty, result });
    } catch (err) {
      // 理论上事务内 getRequest 已确认不存在，此处防御性捕获
      // 若因极端并发仍冲突，回滚整个事务，由上层重试或报错
      throw err;
    }

    return result;
  });
}
```

### 关键设计点
| 要素 | 处理方式 | 依据 |
|------|----------|------|
| 原子性 | 全部读写放入 `db.tx(tenant, ...)` | M2：同租户事务可串行化，回调异常回滚 |
| 幂等 | 事务内先 `getRequest`，命中则比对 sku/qty | M1：同键同参返原结果，异参抛 CONFLICT |
| 不足 | `OUT_OF_STOCK` 在事务内抛出，自动回滚 | M1：不足不占用 requestId |
| 数据库错误 | 原样向上抛出 | M1：不伪造业务成功 |
| 跨租户 | 每次调用独立 `db.tx(tenant,...)` | M2：跨租户独立 |

---

## 3. 定向测试设计（静态推演，非实测）

> ⚠️ 以下为基于给定契约的**可执行测试用例设计**，标注了预期行为与判定标准。**未运行任何真实数据库或工具**。

### T1：正常路径 + 幂等重放
- **初态**：A/P=5
- **操作**：
  1. `reserve(db,{tenant:'A',sku:'P',requestId:'r1',qty:3})`
  2. 再次调用相同参数
- **预期**：
  - 第1次返回 `{remaining:2}`
  - 第2次返回 `{remaining:2}`（非重新计算）
  - 库存始终为 2，`getRequest` 记录仅一条
- **通过判据**：两次返回值深度相等；`getStock` 不变；无额外 `putRequest`

### T2：并发超卖防护
- **初态**：A/P=5
- **操作**：使用可控调度器模拟两进程交错：
  - P1 进入 tx → 读 stock=5 → 挂起
  - P2 进入 tx → 读 stock=5 → 挂起
  - P1 恢复 → setStock(2) → putRequest(r1) → commit
  - P2 恢复 → 因串行化，其 getStock 应看到最新值或阻塞至 P1 提交后读到 2 → 2<3 → OUT_OF_STOCK
- **预期**：最多一个成功；另一个抛 `OUT_OF_STOCK`；最终库存 ≥ 0
- **注意**：此测试依赖 `db.tx` 串行化语义正确实现；若夹具不支持真并发调度，可用顺序模拟验证逻辑分支

### T3：幂等冲突
- **初态**：A/r1 已有记录 {sku:'X',qty:2,result:{remaining:8}}
- **操作**：`reserve(db,{tenant:'A',sku:'Y',requestId:'r1',qty:2})`
- **预期**：抛 `Error('IDEMPOTENCY_CONFLICT')`；库存不变；无新记录

### T4：提交后断连重试一致性
- **初态**：A/P=5
- **操作**：
  1. 第一次调用注入故障：在 `tx` 内部 `putRequest` 成功后、`db.tx` 返回前断开连接 → 调用方收到超时
  2. 第二次调用相同参数
- **预期**：
  - 若数据库保证全有或全无：第一次要么完全提交要么完全回滚
  - 若已提交：第二次 `getRequest` 命中 → 返回原 result，不再扣减
  - 若未提交：第二次正常执行扣减
  - **绝不出现**：库存扣了但无记录 / 有记录但库存未扣
- **判定标准**：最终 `getStock + sum(requests.qty)` == 初始库存

### T5：无效输入
- **操作**：`qty=0`, `qty=-1`, `qty=1.5`, `qty=Number.MAX_SAFE_INTEGER+1`
- **预期**：全部抛 `INVALID_QTY`；无任何 DB 调用发生（可在 mock 层断言）

---

## 4. 尚待真实工程验证的边界

| 风险项 | 说明 | 建议后续动作 |
|--------|------|--------------|
| `db.tx` 串行化粒度 | M2 称“同租户可串行化”，但未说明是否含隐式锁等待或乐观冲突重试策略 | 需查阅驱动文档或压测确认高争用下延迟表现 |
| `putRequest` 唯一键冲突时机 | 事务内 `getRequest` 后到 `putRequest` 间是否有其他路径插入同键？理论上串行化排除，但需验证实现 | 构造极端交错日志审查 |
| 大事务持锁时间 | 若 `getStock` 慢查询，可能延长事务持有期影响吞吐 | 监控 tx 平均耗时，必要时拆分热点 SKU |
| 客户端重试风暴 | 超时后客户端立即重试可能导致大量排队事务 | 建议在网关层加退避重试，非本函数职责但需协同 |

---

## 交付摘要

- **修正代码**：将全部状态变更纳入 `db.tx(tenant,...)`，事务内完成幂等检查→库存校验→扣减→记账，确保原子性与串行化。
- **失败时序分析**：明确指出原实现在并发读-改-写及提交中断两种场景下的契约违背。
- **测试设计**：覆盖正常、幂等重放、冲突、并发超卖、断连重试、非法输入六类场景，给出可观察判据。
- **未执行声明**：以上均为静态分析与推演，未调用任何工具、未访问文件、未运行测试。所有结论严格限定于题面合成材料。
