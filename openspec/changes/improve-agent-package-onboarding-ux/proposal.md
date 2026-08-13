## Why

当前 Agent Team Runtime 已通过工程门禁，但导入与运行反馈在 C 端仍存在理解成本：用户难以在安装前判断权限与风险、等待态缺少下一步动作、失败恢复路径不够直观。这会直接拉低首轮成功率与复用率，限制后续能力目录商业化转化。

## What Changes

- 新增安装前导入向导：解析 Package 能力、权限、兼容性与估算成本，并输出可执行风险提示与回滚入口。
- 新增运行态“下一步指引”卡：统一展示当前阻塞原因、建议动作、预计等待和超时后兜底动作。
- 新增取消/恢复可视化状态机：从请求中到已收敛的全链路反馈，避免用户误判。
- 新增失败修复动作映射：针对常见失败类型提供“重试/降级本地/切换后端/收敛上下文”的一键入口。
- 补齐导入向导与 live cancel 的 Electron 场景化验收与 QA 证据。

### 目标用户

- 首次安装 Agent Team 的个人用户。
- 需要对权限、成本与可恢复性做风控的团队管理员。
- 负责上架与交付 Agent Team 的 Builder 团队。

### 商业化与体验价值

- 将“可安装”提升为“可理解、可决策、可回退”，提升导入转化率与首轮任务完成率。
- 降低运行中断后的流失风险，提升 Team Workflow 的复用频次与付费意愿。
- 为后续精选能力目录建立标准化“导入前信任面板”，支持企业采购审查流程。

### 验收标准

- 用户在导入前可以看到权限、兼容性、风险与成本摘要，并可在 10 秒内完成“安装/取消”决策。
- 运行中出现 `WAITING_*`、`FAILED`、`CANCELLED` 时，界面均有明确的“下一步动作”与状态解释。
- 父 Run 取消时可见 `requesting_cancel -> cancelling_children -> cancelled` 过渡反馈，避免无反馈等待。
- 至少 4 类常见失败（远程超时、权限不足、协议不兼容、证据不足）提供结构化修复入口。
- Electron smoke 与 QA 反模式走查覆盖导入向导与 live cancel 主路径，控制台无新增 uncaught error。

### 非目标（Non-goals）

- 不在本期引入开放市场、计费结算或第三方发布平台。
- 不改变现有 Runtime 协议版本或 Message Bus envelope 结构。
- 不在本期实现跨设备同步恢复，仅覆盖当前设备内的运行恢复体验。

## Capabilities

### New Capabilities

- `agent-package-onboarding-ux`: 标准化 Agent Package 导入向导、风险预览与回滚入口。
- `agent-runtime-guided-recovery`: 标准化运行阻塞提示、失败修复动作与取消恢复可视化流程。

### Modified Capabilities

- `workspace`: 扩展工作台在导入、等待、失败与取消阶段的交互反馈与操作入口。
- `agent-output-protocol`: 增加用于 UI 指引的运行诊断事件映射与状态语义约束。

## Impact

- 渲染层：`src/workspace-agent.js`、`src/workspace.html`、相关样式与状态渲染逻辑。
- 协议映射层：`src/lib/agent-output-protocol.js`、`src/lib/agent-message-state.js`。
- 主进程与 IPC：导入预检、取消状态回传与恢复入口编排。
- 测试资产：新增导入向导与 live cancel 的 Electron smoke、QA 证据与回归用例。
