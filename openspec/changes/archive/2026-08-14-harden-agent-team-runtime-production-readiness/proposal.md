## Why

已完成的 Agent Runtime 评估证明基础编排可运行，但仍存在 Run 权威状态双轨、恢复数据损坏边界不足、Package 只有内容哈希而没有发布者身份认证、真实后端门禁不完整等生产风险。现在补齐这些 P0，能让个人与团队用户在取消、重启、远程断连和包篡改时得到可解释且 fail-closed 的结果，而不是登记式成功或不可审计的漂移。

## What Changes

- 由 `AgentRunManager` / `AgentRunStore` 统一承担子 Run 查询、取消、恢复与终态权威，移除 `main.js` legacy `activeSubRuns` 双轨；根 Run 仍兼容现有 `activeAgentRuns` 控制器。
- 强化 RunStore 的 hash-chain/序列校验与损坏诊断；恢复时将不可信 state/event tail 标记为 interrupted 或拒绝恢复，不静默跳过中段损坏。
- 增加确定性 fault/chaos 套件，覆盖重复 terminal/callback、截断与篡改日志、进程中断、网络超时/断连、取消风暴、幂等副作用和资源泄漏。
- 新增 Package trust policy：完整 SHA-256 内容锁、Ed25519 发布者签名、可信公钥/撤销列表、权限差异审阅和兼容迁移；哈希仅表示完整性，不冒充身份认证。
- 强化 Cursor/Claude/Daemon Agent Service 的 readiness probe、超时与断连语义，并提供 hermetic loopback 成功/失败/澄清/取消/恢复门禁。
- live E2E 在缺 token、后端或能力时输出结构化 `BLOCKED`/`ADVISORY` 与可复跑命令，禁止伪造 PASS。
- 增加队列深度、取消延迟、恢复结果、重复终态、资源泄漏、协议/信任拒绝等结构化 metrics，并写入证据。

### 目标用户

- 依赖 KnowMe 长时间运行多 Agent/Team Workflow 的知识工作者和制作团队。
- 需要审计 Package 来源、权限变化、取消与恢复结果的企业部署与运维人员。
- 维护 Cursor、Claude、Workbench Daemon 兼容后端的开发与测试人员。

### 验收标准

- 子 Run 的状态查询、取消、恢复和终态仅由 RunManager/RunStore 判定；生产路径不存在 `activeSubRuns` 登记式成功。
- 篡改、撤销、不可信发布者、签名不匹配和未审阅权限扩大均 fail-closed；legacy 无签名包只能经显式兼容策略使用。
- fault/chaos 套件确定性通过，重复终态不重复回调，取消风暴无活动 launch/waiter/定时器泄漏，恢复结果可观测。
- hermetic/loopback 后端契约硬通过；live 环境不可用时证据明确为 `BLOCKED` 或 `ADVISORY`，包含缺失条件和重跑命令。
- 相关专项、`npm test`、`npm run lint`、必要 eval 和 harness gate 有真实证据；开发自测、制作人验收、测试 QA 与代码审查工件齐备。

### 非目标（Non-goals）

- 不替换 `AgentRunExecutor` 的单 Run model/tool loop。
- 不建立在线 Package 市场、证书颁发机构、透明日志或自动密钥轮换服务。
- 不把 SHA-256 内容锁描述为发布者身份认证。
- 不要求缺少外部凭证的机器通过 live E2E，也不归档现有 `agent-package-and-team-runtime` change。
- 不重构无关 UI、连接器或历史 Session 数据。

## Capabilities

### New Capabilities

- `agent-package-trust`: 定义 Package 完整性、发布者签名、可信密钥、撤销、权限差异审阅和兼容迁移的 fail-closed 契约。
- `agent-runtime-production-readiness`: 定义故障恢复、结构化可观测性、远程后端 readiness/live 门禁与诚实证据要求。

### Modified Capabilities

- `agent-orchestration`: 子 Run 生命周期的唯一权威改为 RunManager/RunStore，并规定重复终态、取消风暴和恢复语义。
- `agent-eval-harness`: 增加 hermetic fault/chaos 与跨后端门禁；live 不具备条件时必须输出 BLOCKED/ADVISORY。

## Impact

- 代码：`src/main.js`、`src/lib/agent-run-manager.js`、`agent-run-store.js`、`agent-run-launcher.js`、`agent-package-runtime.js`，以及最小新增 trust/metrics 模块。
- 测试与脚本：Team Runtime 专项测试、fault/chaos 测试、Agent Service loopback/live harness 与结构化 evidence。
- API：RunManager 增加 diagnostics/metrics；Package load/materialize 接受显式 trust policy；Remote adapter readiness 变为异步探测。
- 数据：Package lock 升级为完整 SHA-256 与可选签名 provenance；旧 16 位 hash 通过显式 migration policy 兼容，不自动视为可信。
- 依赖：仅使用 Node 内置 `crypto`，不新增第三方安全依赖。
