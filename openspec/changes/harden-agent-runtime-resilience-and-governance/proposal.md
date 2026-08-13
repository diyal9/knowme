## Why

生产级 Runtime 已具备核心能力，但在远程链路波动、legacy 双轨状态、供应链信任和团队级成本治理上仍有可预期风险。若不提前补强，规模化接入更多 Builder 与 Team Workflow 时会放大故障半径和运维成本。

## What Changes

- 收口 Run 状态权威，清理 legacy `activeSubRuns` 双轨路径，统一由 RunManager 驱动查询与控制。
- 增加远程执行健康探针与自动降级策略：远程异常时可切换本地执行并保留审计上下文。
- 增加 Package 供应链可信增强：签名校验、来源元数据与吊销列表 fail-closed。
- 增加 Team/Workspace 级预算与 SLO 守卫，支持异常工作流熔断与治理告警。
- 补齐 Daemon live E2E 稳定性门禁与运维证据，降低上线后灰故障。

### 目标用户

- 负责多 Builder 运行稳定性的平台开发与运维团队。
- 需要可审计权限与成本边界的企业管理员。
- 依赖 Agent Team 完成关键流程的业务用户。

### 商业化与体验价值

- 提升跨 Builder 工作流可靠性，减少失败与等待带来的体验流失。
- 强化供应链可信和预算治理，为企业订阅与审计采购提供必要前置条件。
- 降低线上事故恢复成本，提升 Agent Team 的长期留存和口碑。

### 验收标准

- Runtime 仅保留单一状态权威路径，核心查询/取消/恢复不再依赖 legacy 双轨数据结构。
- 远程后端异常时，系统可在策略允许下自动降级到本地执行，并保留可追踪事件链。
- Package 安装支持签名与来源校验；签名失效或命中吊销列表时 fail-closed。
- Team/Workspace 级预算阈值可配置并可触发熔断，SLO 指标可在运行中查询。
- Daemon live E2E 覆盖 token/need_input 场景并产出稳定门禁证据。

### 非目标（Non-goals）

- 不在本期建设跨组织证书基础设施或第三方 CA 托管服务。
- 不改变现有单 Agent Loop 与 Grounding 的核心行为模型。
- 不在本期引入复杂多租户计费系统，仅提供预算阈值与守卫机制。

## Capabilities

### New Capabilities

- `agent-runtime-resilience-guard`: 远程健康探针、自动降级、本地回退与故障收敛策略。
- `agent-package-trust-policy`: Package 签名、来源声明、吊销列表与 fail-closed 安装治理。

### Modified Capabilities

- `agent-run`: 收口单一状态源、团队级预算守卫与熔断策略。
- `agent-orchestration`: 扩展远程健康状态、降级原因与恢复建议语义。

## Impact

- Runtime 主干：`src/lib/agent-run-manager.js`、`src/lib/agent-run-scheduler.js`、`src/lib/agent-run-launcher.js`。
- 协议层：`src/lib/agent-package-runtime.js`、`src/lib/agent-orchestration.js`。
- 主进程集成：`src/main.js` 中 Team Runtime 生命周期与健康探针接入点。
- 测试与证据：Daemon live E2E、故障注入、预算熔断、签名校验相关用例与报告。
