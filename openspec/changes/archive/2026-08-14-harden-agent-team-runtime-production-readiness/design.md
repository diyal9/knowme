## Context

见 `proposal.md`。现有 `AgentRunManager` 已持有 Run 树、持久化、取消与恢复能力，`AgentRunLauncher` 持有短生命周期执行句柄；但 `main.js` 仍有未写入的 `activeSubRuns` legacy Map，RunStore 的 tolerant replay 会跳过任意坏行且不验证 hash chain，Package 内容哈希只有截断 16 位且没有签名信任策略，remote `probeHealth()` 只检查 client 是否存在。原 change 的 live Daemon evidence 也把环境与产品失败混在一起。

共享工作区有大量现有用户改动。本实现只做局部补丁，不覆盖 `agent-package-and-team-runtime` 工件，不归档、不提交。

## Goals / Non-Goals

**Goals:**

- 让 RunManager/RunStore 成为子 Run 生命周期唯一权威，Launcher 只保存可释放 handle，根 Run `activeAgentRuns` 仅保留兼容 abort 作用。
- 对持久化恢复给出可证明的完整/截断/损坏判定，损坏时 fail-closed。
- 用 Node 内置 SHA-256/Ed25519 实现可测试信任策略，明确区分 integrity 与 authenticated publisher。
- 用同一套结构化 metrics 覆盖取消、恢复、重复终态、队列/资源和拒绝原因。
- 把 hermetic 硬门禁和 live 环境证据拆分；缺外部条件时诚实 BLOCKED。

**Non-Goals:**

- 不修改 `AgentRunExecutor` model/tool loop。
- 不自动信任 legacy、无签名或未知发布者 Package。
- 不实现 CA、联网撤销查询、密钥托管或市场发布。
- 不要求 renderer 直接读取信任策略、RunStore 路径或内部 metrics 可变对象。

## Decisions

### D1. RunManager 是状态权威，Launcher 是资源 registry

- 删除 `main.js` `activeSubRuns` 及其 cancel sweep。
- `ai-cancel-run` 保留根 `activeAgentRuns` abort，然后调用 `RunManager.cancelRun()`；子树递归完全由 manager 完成。
- Manager 的 `getRunStatus/getRunTree/recover/cancel` 只从 manager cache + RunStore 读取，不依赖 launcher handle。
- Launcher 的 `activeLaunches`、Manager 的 abortControllers/waiters 在终态释放，并通过 diagnostics 暴露泄漏计数。

替代方案：保留两个 Map 并周期同步。拒绝，因为同步窗口无法消除分歧，且会让恢复后句柄缺失被误判为 Run 不存在。

### D2. 单调 metrics collector，快照只含计数/延迟

新增轻量 runtime metrics collector，支持 `increment`、`observe`、`gauge` 和不可变 snapshot。Manager、Store、Launcher 与 trust policy 可注入同一 collector；未注入时使用私有实例，避免全局测试污染。

指标包含：queue depth、active runs/launches/waiters、cancel count/latency、recovery outcomes、duplicate terminals、corrupt persistence、protocol/trust rejection、resource leak count。不得记录 prompt、secret 或完整 args。

替代方案：直接接 Prometheus/OpenTelemetry。当前桌面应用没有采集端，引入依赖与 exporter 会扩大范围。

### D3. RunStore 严格校验，尾部截断是唯一自动容错

新增 `inspectEventLog()`：

1. 按物理行解析；
2. 只允许最后一个非空行 JSON 截断；
3. 校验 `seq` 连续、`prevHash` 与重算 `recordHash`；
4. 返回 `ok/tailTruncated/code/lastGoodSeq`。

`replay()` 默认使用严格 inspect；检测中段损坏或 hash 不匹配时返回 `ok=false`，Manager 不自动恢复该 Run。旧无 hash 事件仅在显式 `allowLegacyUnchained` migration 模式读取。

替代方案：继续 `tolerantTail` 跳过所有坏行。拒绝，因为会越过未知副作用或终态事件。

### D4. Package trust 独立于 schema normalization

新增 `agent-package-trust.js`：

- RFC 风格递归稳定 JSON canonicalization；
- 完整 64 hex SHA-256；
- 签名 envelope 绑定 packageId/version/contentHash/permissionDigest；
- Ed25519 sign/verify；
- policy `{mode, trustedPublishers, revokedPublisherIds, revokedKeyIds, allowIntegrityOnly, allowLegacyHash}`；
- 权限 flatten/diff 和 review receipt 校验。

`agent-package-runtime` 继续做 schema/adapter；load/import/materialize 可显式调用 trust 验证。strict 生产策略 fail-closed；legacy 开发迁移只有调用方明确启用才返回 integrity-only/migration 状态。

替代方案：把 hash 直接当签名。拒绝，因为持有文件的人都能重算 hash，不能认证身份。

### D5. Remote readiness 走真实握手并统一 deadline

`probeHealth()` 改为 async：用 deadline 包装 handshake，验证 execute/status/cancel capability。launch/execute/status/resume 同样将 timeout、AbortError、socket 断开映射为稳定 code；失败不产生 terminal success。

Hermetic loopback 服务支持 READY、completed、failed、need_input、cancelled、resumed、timeout/disconnect。Live harness 只读取环境提供的 endpoint/token，不包含秘密；前置不满足写 BLOCKED 报告并正常完成证据生成。

### D6. Electron 边界保持最小

- Main：RunManager、RunStore、Launcher、trust/metrics；负责唯一状态变更与持久化。
- Preload/IPC：沿用现有 run tree/status/cancel/retry/resume plain-object 契约；可选 diagnostics 只返回脱敏 snapshot。
- Renderer：无需理解签名私钥、RunStore 或 Launcher handle；现有 UI 行为不变。

启动与内存：trust 验证按 Package load/materialize 执行，不在 Electron startup 扫描全目录；metrics 仅固定 key map 和有限 histogram 汇总；RunStore inspect 按需读取单 Run 日志，遵守现有 50MB cap。

## Risks / Trade-offs

- [严格 hash-chain 会暴露旧坏日志] → 仅尾截断自动恢复；报告明确 migration/blocker，不静默继续。
- [完整 SHA-256 改变旧 snapshot hash] → lock 标记算法/格式；显式 legacy migration，不把旧短 hash 自动升级为可信。
- [并发 cancel 与 terminal 竞态] → Manager 首终态胜出、重复计数、取消 Promise 去重并最终统一 cleanup。
- [remote capability 命名差异] → readiness 接受协议规定的最小集合并报告缺失项，不猜测可用性。
- [共享 main.js 有用户改动] → 只删除 1 个声明和 cancel handler 内 legacy sweep，保留其他内容。
- [live 后端不可用] → hermetic 为硬门禁，live 状态 BLOCKED/ADVISORY，证据包含重跑命令。

## Migration Plan

1. 先部署新 metrics、RunStore inspect 与 fault tests，不改变 renderer。
2. 删除 `activeSubRuns` legacy 路径；保留根 Run controller 兼容。
3. Package lock 新写入完整 SHA-256；读取旧短 hash 时返回 migration-required，调用方显式选择重新锁定。
4. strict trust policy 用于需要生产信任的导入/运行入口；本地开发包若显式允许可保持 integrity-only，界面/报告不得显示 publisher verified。
5. Remote readiness/live harness 分开出证据。

回滚：可回退调用方的 strict trust policy，但不得回到登记式假成功；新 RunStore 事件格式仍为 v1 且附 hash，不删除用户数据。恢复代码对明确允许的 legacy unchained 日志保持只读迁移入口。

## Open Questions

- 可信发布者公钥的最终企业配置 UI 与 OS 密钥存储由后续 Story 决定；本 change 只定义可注入 policy 与文件外密钥边界。
- Live Cursor/Claude 的具体 endpoint/token 名称由部署环境提供；harness 支持通用环境变量并报告缺失条件。
