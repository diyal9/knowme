## 1. 原实现的决定性失败时序

原代码存在 **TOCTOU（检查与使用之间竞态）** 和 **非原子写入** 两类致命缺陷：

### 反例 A：超卖（两个进程并发读同一库存）
```
初始: tenant=A, sku=P, stock=5
P1: reserve(A,P,r1,4)          P2: reserve(A,P,r2,3)
  getStock → 5                   (穿插)
  5 >= 4 ✓                       getStock → 5
  setStock(5-4=1)                5 >= 3 ✓
                                 setStock(5-3=2)   ← 覆盖P1的写入
最终 stock=2，实际应扣7件，超卖2件。
```
`getStock` 与 `setStock` 之间无锁、无事务，另一进程可读到相同旧值并各自基于它计算新值，后写者覆盖前者。

### 反例 B：扣减成功但请求账本丢失（崩溃/异常窗口）
```
P1: setStock(stock-qty) 成功
    ← 此处进程崩溃 / putRequest抛非唯一键错误
结果: 库存已扣，但getRequest查不到记录。
重试同requestId → old为undefined → 再次扣减 → 双重扣款。
```

### 反例 C：幂等冲突未检测
同 requestId 不同 sku/qty 时，原代码直接返回首次 result，违反契约要求的 `IDEMPOTENCY_CONFLICT`。

---

## 2. 为什么常见较小改法不够

| 改法 | 不足原因 |
|------|----------|
| 加 `if (old.sku !== sku \|\| old.qty !== qty) throw IDEMPOTENCY_CONFLICT` | 仅修反例C；A/B仍失败 |
| 用 CAS：`db.casSetStock(tenant,sku,expected,new)` | 题面未提供此API；即便有，putRequest与setStock仍非原子（反例B） |
| 先 putRequest 占位再 setStock | 若 setStock 失败需回滚占位，但无事务则回滚本身也可能失败；且 OUT_OF_STOCK 不应占用 requestId，逻辑倒置 |
| 全局互斥锁 | 引入外部依赖，违反"不发明新API/不引入外部依赖"约束 |

核心问题：**扣减与账本写入必须原子提交，且整个读-判-写序列必须在同一串行化单元内完成。** 只有 `db.tx` 同时满足这两点。

---

## 3. 修正代码

```javascript
async function reserve(db, { tenant, sku, requestId, qty }) {
  // ── 入参校验（在事务外，避免无效参数开启事务）──
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error('INVALID_QTY');
  }

  return db.tx(tenant, async (tx) => {
    // ① 幂等检查（事务内，串行化保证不会与后续写入穿插）
    const existing = await tx.getRequest(tenant, requestId);
    if (existing) {
      if (existing.sku !== sku || existing.qty !== qty) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return existing.result;
    }

    // ② 读取当前库存（事务内，同租户串行化阻止并发读到旧值）
    const stock = await tx.getStock(tenant, sku);

    // ③ 库存充足性判断
    if (stock < qty) {
      throw new Error('OUT_OF_STOCK');
    }

    // ④ 扣减 + 写账本（同一事务，全有或全无）
    const remaining = stock - qty;
    const result = { remaining };

    await tx.setStock(tenant, sku, remaining);
    await tx.putRequest(tenant, requestId, { sku, qty, result });

    return result;
  });
}
```

### 关键设计说明

- **`qty` 校验放在 `db.tx` 之前**：`INVALID_QTY` 不得改变库存/账本，也不应开启事务。
- **全部业务读写在 `tx` 回调内**：利用"同租户事务可串行化"消除 TOCTOU。
- **`OUT_OF_STOCK` 在事务内抛出**：回调异常触发回滚，`putRequest` 不会被执行，requestId 不被占用——符合契约。
- **`IDEMPOTENCY_CONFLICT` 同理**：抛错即回滚，不产生任何副作用。
- **数据库超时**：若提交前断连，事务回滚，调用方收到异常；若提交后断连，数据已持久化，调用方可安全重放（走幂等分支）。两种情况均不破坏一致性。

---

## 4. 定向测试设计

> 以下均为**静态推演用例**，标注预期行为；实际执行需接入合成夹具驱动。

### T1 — 基本成功
| 项 | 值 |
|----|-----|
| 初态 | A/P stock=10, 无请求记录 |
| 操作 | `reserve(db,{tenant:'A',sku:'P',requestId:'r1',qty:3})` |
| 预期 | 返回 `{remaining:7}`；stock=7；request r1 存在且 result={remaining:7} |

### T2 — 幂等重放（同键同参）
| 项 | 值 |
|----|-----|
| 前置 | T1 已成功 |
| 操作 | 再次 `reserve(...,requestId:'r1',qty:3)` |
| 预期 | 返回 `{remaining:7}`；stock 仍为 7；不再次扣减 |

### T3 — 幂等冲突（同键异参）
| 项 | 值 |
|----|-----|
| 前置 | T1 已成功 |
| 操作 | `reserve(...,requestId:'r1',qty:5)` |
| 预期 | 抛 `IDEMPOTENCY_CONFLICT`；stock 不变；r1 记录不变 |

### T4 — 跨租户同名 requestId
| 项 | 值 |
|----|-----|
| 初态 | A/P stock=5, B/P stock=5 |
| 操作 | P1: `reserve(A,...,r3,2)`；P2: `reserve(B,...,r3,3)` |
| 预期 | 两者均成功；A stock=3, B stock=2；各自独立账本 |

### T5 — 并发防超卖（决定性反例）
| 项 | 值 |
|----|-----|
| 初态 | A/P stock=5 |
| 操作 | P1: `reserve(A,P,r1,4)` 与 P2: `reserve(A,P,r2,3)` 并发发起 |
| 预期 | 恰好一个成功（remaining=1），另一个抛 `OUT_OF_STOCK`；stock ∈ {1, 5}，绝不出现负数或双成功 |
| 验证要点 | 串行化保证第二个事务进入时看到第一个已提交的 stock=1，1<3 → OUT_OF_STOCK |

### T6 — INVALID_QTY 边界
| 输入 qty | 预期 |
|-----------|------|
| `0` | `INVALID_QTY` |
| `-1` | `INVALID_QTY` |
| `1.5` | `INVALID_QTY` |
| `Number.MAX_SAFE_INTEGER + 1` | `INVALID_QTY` |
| `NaN` | `INVALID_QTY` |
| `'3'`（字符串） | `INVALID_QTY` |

所有情况：stock 不变，requestId 不写入。

### T7 — 库存不足不占用 requestId
| 项 | 值 |
|----|-----|
| 初态 | A/P stock=2 |
| 操作 | `reserve(A,P,rX,5)` → 抛 OUT_OF_STOCK |
| 后续 | `reserve(A,P,rX,1)` → 应成功（因 rX 未被占用） |

### T8 — 事务回滚完整性（模拟 putRequest 失败）
| 项 | 值 |
|----|-----|
| 方法 | 注入 mock：使 `tx.putRequest` 在第二次调用时抛非唯一键异常 |
| 预期 | 整个事务回滚；stock 恢复原值；requestId 无记录 |

---

## 5. 尚待真实工程验证的边界

| 编号 | 风险点 | 说明 |
|------|--------|------|
| V1 | `db.tx` 串行化粒度 | 题面称"同租户事务可串行化"，但未明确是租户级还是 (tenant,sku) 级。若仅租户级，不同 sku 的事务也会互相阻塞，影响吞吐但不影响正确性；若实现有 bug 导致非严格串行化，T5 可能退化 |
| V2 | 提交后断连的重放语义 | 契约说"调用方事后可用相同 requestId 再次请求"，但若首次事务已提交而客户端未收到响应，重放走幂等分支返回缓存 result——需确认 `getRequest` 在事务内能读到刚提交的记录（取决于隔离级别） |
| V3 | `qty` 极大值溢出 | `Number.isSafeInteger` 已拦截，但若上游传入 `qty > stock` 且 stock 接近 MAX_SAFE_INTEGER，减法不会溢出（因为 stock≥qty 才执行），逻辑安全但值得压测确认 |
| V4 | 多 SKU 批量预留扩展 | 当前接口单 SKU；若未来扩展为数组，需在单个事务内处理多个 SKU 的读-判-写，串行化范围是否覆盖多 SKU 组合需重新评估 |
| V5 | 性能：事务持锁时间 | 每次 reserve 持有租户级事务直到返回；高并发下同一租户的请求会排队。游戏场景通常按玩家/公会分片，单租户 QPS 可控，但需压测确认尾延迟 |

以上为纯静态审查交付，未执行任何工具、未访问文件、未运行测试。
