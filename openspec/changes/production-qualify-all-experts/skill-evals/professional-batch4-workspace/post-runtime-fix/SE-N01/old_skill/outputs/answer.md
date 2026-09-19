## 1. 原实现的决定性失败时序

`reserve` 在事务外执行 `getRequest → getStock → setStock → putRequest`，四个调用之间可被另一进程穿插。两个最小反例：

**超卖（A/r1 qty=4、A/r2 qty=3，库存 5）**
```text
P1: getRequest(A,r1) → undefined
P2: getRequest(A,r2) → undefined
P1: getStock(A,P) → 5
P2: getStock(A,P) → 5          // 读到同一旧值
P1: setStock(A,P,1)
P2: setStock(A,P,2)            // 覆盖 P1 的写；总扣减 7 > 5
```
即使把顺序改成“先 `putRequest` 再扣库存”，仍会留下请求账本与库存不一致，或让不足库存的请求错误占用 requestId。

**跨租户幂等误判（A/r3 与 B/r3）**
若只按全局 `requestId` 查重，B/r3 可能命中 A/r3 的记录并返回错误结果。当前代码虽传了 tenant，但整个检查—写入序列没有原子边界，同租户并发重放也可能双双通过 `getRequest`。

## 2. 最小完整修正

```js
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function assertValidQty(qty) {
  if (
    typeof qty !== 'number' ||
    !Number.isSafeInteger(qty) ||
    qty <= 0
  ) {
    throw new Error('INVALID_QTY');
  }
}

async function reserve(db, { tenant, sku, requestId, qty }) {
  assertValidQty(qty);

  return db.tx(tenant, async tx => {
    const old = await tx.getRequest(tenant, requestId);
    if (old) {
      if (old.sku !== sku || old.qty !== qty) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return old.result;
    }

    const stock = await tx.getStock(tenant, sku);
    if (stock < qty) throw new Error('OUT_OF_STOCK');

    const remaining = stock - qty;
    await tx.setStock(tenant, sku, remaining);

    const result = { remaining };
    await tx.putRequest(tenant, requestId, { sku, qty, result });
    return result;
  });
}
```

### 为什么这个修法覆盖问题

- **qty 校验在事务前**：非法输入不触达库存/账本。
- **同租户事务串行化**：`getRequest → getStock → setStock → putRequest` 不可被其他进程穿插，消除读—改—写竞态和超卖。
- **异常回滚**：`OUT_OF_STOCK`、`IDEMPOTENCY_CONFLICT` 或数据库错误都不会留下半提交状态。
- **租户隔离**：事务键为 tenant，A/r3 与 B/r3 互不影响。
- **重放语义**：同键同 sku/qty 直接返回首次 `result`；不同则冲突。
- **超时后重试安全**：提交前断连则无副作用；提交后断连则 `getRequest` 命中已有记录并返回原结果。

### 常见较小改法为何不够

| 改法 | 缺口 |
|---|---|
| 仅加 `if (stock >= qty)` | 仍是非原子读—改—写，不能防并发超卖 |
| 仅交换 `setStock` / `putRequest` 顺序 | 任一失败都可能造成库存与账本不一致 |
| 仅捕获 `putRequest` 唯一键冲突后重查 | 库存已经扣减，无法回滚；且冲突原因可能是不同 sku/qty |
| 仅给 requestId 加锁 | 未保护 `(tenant,sku)` 库存行，同 SKU 不同请求仍可超卖 |
| 仅依赖 `db.setStock` 原子性 | 它只是单点赋值，不提供“比较旧值后更新”的条件语义 |

## 3. 定向测试设计

以下均为基于给定契约的**静态推演用例**，不是已执行测试回执。

### T1 非法 qty

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 5，无请求记录 |
| 操作 | `reserve(db,{tenant:'A',sku:'P',requestId:'r1',qty:0})`；分别测 `-1`、`1.5`、`NaN`、`Infinity`、`MAX_SAFE+1`、字符串 `'1'` |
| 预期 | 抛 `INVALID_QTY`；库存仍 5；`getRequest(A,r1)=undefined` |

### T2 顺序成功与重放

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 5 |
| 操作 | r1 qty=2 → r1 qty=2 |
| 预期 | 两次均返回 `{remaining:3}`；库存只扣一次 |

### T3 同键不同参数

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 5；已成功 A/r1 qty=2 |
| 操作 | A/r1 qty=3；A/r1 sku='Q' qty=2 |
| 预期 | 均抛 `IDEMPOTENCY_CONFLICT`；库存保持 3；不新增记录 |

### T4 库存不足且不占 requestId

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 1 |
| 操作 | A/r1 qty=2 |
| 预期 | 抛 `OUT_OF_STOCK`；库存仍 1；`getRequest(A,r1)=undefined` |

### T5 决定性并发超卖回归

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 5 |
| 操作 | 两进程同时发起 A/r1 qty=4、A/r2 qty=3 |
| 预期 | 恰好一个成功；另一个抛 `OUT_OF_STOCK`；最终库存 ≥0 且等于 5 减去成功数量 |

### T6 跨租户同名 requestId

| 项 | 内容 |
|---|---|
| 初态 | A/P 库存 5，B/P 库存 5 |
| 操作 | 并发 A/r3 qty=2、B/r3 qty=3 |
| 预期 | 两者均可独立成功；A 剩余 3、B 剩余 2；各自账本互不污染 |

### T7 提交前后断连

| 场景 | 预期 |
|---|---|
| 事务提交前超时 | 无库存变化、无请求记录；相同 requestId 重试可正常执行 |
| 事务提交后客户端超时 | 服务端已持久化；相同 requestId 重试返回原 `{remaining}`，不再扣减 |

### T8 数据库错误透传

| 项 | 内容 |
|---|---|
| 注入 | `getStock/setStock/putRequest/db.tx` 分别抛自定义 `DB_ERR` |
| 预期 | 原样向上抛出；不得包装成业务错误或伪造成功 |

## 4. 尚待真实工程验证的边界

1. **事务串行化粒度**：题面称同租户事务可串行化，但未说明是否等价于全租户级锁。真实实现需确认高并发下吞吐是否可接受。
2. **`tx` 方法签名**：示例假设 `tx.getStock(tenant,sku)` 等方法仍接收 tenant；若实际 API 是 `tx.getStock(sku)`，只需去掉重复 tenant 参数，逻辑不变。
3. **`putRequest` 冲突类型**：当前依赖事务内不存在竞争插入；若底层仍可能抛唯一键冲突，应明确它是程序 bug 还是可恢复错误。
4. **超时后的可见性**：需要实测“提交后断连”时重试能否稳定读到已提交记录，避免网络分区导致假阴性。
5. **库存初始缺失**：契约规定不存在视为 0，但需验证 `setStock` 对首次创建行的约束与类型转换。

以上分析全部基于冻结夹具 M1–M4；未访问文件、未联网、未调用工具、未部署，也未声称任何测试已经运行。
