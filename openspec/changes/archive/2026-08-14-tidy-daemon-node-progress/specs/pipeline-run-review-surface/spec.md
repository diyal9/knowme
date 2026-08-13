## ADDED Requirements

### Requirement: 节点进度文案分层可读

管线审阅「步骤」Tab 的每个编排节点 MUST 分层展示：节点标题；一行「类型 · 执行者」（若有执行者）；若有产出则另起一行短产出标签。节点副文案 MUST NOT 在同一可见行内同时展示内部产出 kind 与完整制品路径。

#### Scenario: 有产出的 Agent 节点

- **WHEN** 节点含 `output.path`（如 `artifacts/proto-changes.md`）
- **THEN** 可见类型与执行者；产出行显示短文件名（如 `proto-changes.md`）
- **AND** 完整路径可通过悬停提示获得，但不作为默认可见长串

#### Scenario: 无产出的并行/循环节点

- **WHEN** 节点无产出定义
- **THEN** 仅显示标题与类型·执行者，不渲染空的产出行

#### Scenario: 窄栏不换行参差

- **WHEN** 审阅右栏宽度不足以容纳副文案
- **THEN** 类型行与产出行各自单行省略（ellipsis），不因超长路径把相邻节点顶成明显参差
