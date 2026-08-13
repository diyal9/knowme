# Code Review

## 结论

APPROVED。未发现 blocking 缺陷；实现保持在 Agent Runtime、package trust、测试与 evidence 范围内。

## 审查要点

### Run 权威与兼容

- `main.js` 不再维护 legacy `activeSubRuns`；子 Run 查询、取消、恢复和终态以 `AgentRunManager` / `AgentRunStore` 为准。
- root/single-Agent controller 仍可处理既有入口，但不会为子 Run 建立第二份状态权威。
- 并发取消复用同一内部 promise，终态只投递一次；重复 terminal 进入指标而非再次产生副作用。

### 恢复与故障边界

- JSONL event chain 同时校验连续 seq、prevHash 和 recordHash。
- 仅最后一条不可解析记录可按 truncated tail 处理；中段损坏、断链、状态损坏均 fail-closed。
- `replay.events` 保留完整审计事件，`appliedEvents` 单独表示 snapshot 后需归并的事件，避免审计视图与恢复算法混淆。

### Package 信任

- canonical payload 使用 SHA-256 内容锁，签名使用 Node 内置 Ed25519。
- publisher/key trust、revocation、signature、permission review 任一不满足时拒绝。
- legacy/hash-only 迁移必须由显式 policy 允许；文档没有把 hash-only 描述为身份认证。
- 权限比较基于规范化 digest，新增权限需要绑定基线和目标摘要的审阅记录。

### Remote 与可观测性

- readiness probe 实际执行 handshake 并验证 capability，不以 adapter 注册代替 readiness。
- timeout/disconnect 有稳定错误码并进入 metrics；terminal callback 去重。
- 指标覆盖 queue depth、cancel latency、recovery、duplicate terminal、resource leak、protocol/trust rejection。

## 风险与建议

- Live Cursor/Claude/Daemon 尚未在本机完成真实执行，原因是 endpoint/token 缺失；结构化证据为 `BLOCKED`，不影响 hermetic 硬门禁，但发布环境接入后应复跑。
- Windows connector 临时文件原子 rename 曾出现一次瞬时 `EPERM`，单项与全量复跑通过。该代码不在本 change 修改范围，保留为环境 advisory。
- 信任策略上线应先以显式兼容模式盘点现有未签名 package，再切换 required-signature；不应静默放宽 production policy。

## 验证

- 专项 14/14
- Hermetic E2E 8/8
- Agent eval 6/6
- 全量 1423/1423
- lint、OpenSpec strict validate 通过
