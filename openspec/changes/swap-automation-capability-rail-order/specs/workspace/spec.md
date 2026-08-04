## MODIFIED Requirements

### Requirement: Left rail provides one unified capability entry

工作台左侧 rail MUST 仅提供一个“能力”图标入口。图标 MUST 有 tooltip 与 aria-label。点击 MUST 打开 Capability Hub 全屏层（见 capability-hub spec），不得再将专家、技能和连接器作为三个独立 rail 入口展示。能力入口 MUST 紧随工作台入口，并位于自动化入口上方的主导航分组中；自动化入口 MUST 位于其后的分隔分组。

#### Scenario: Single capability rail icon visible

- **WHEN** 用户进入 Agent 工作台
- **THEN** rail 仅显示一个“能力”图标入口
- **AND** rail 不再分别显示专家、技能、连接器三个图标

#### Scenario: Capability and automation use the requested order

- **WHEN** 用户查看工作台左侧 rail
- **THEN** 能力入口紧随工作台入口显示
- **AND** 自动化入口显示在能力入口下方的分隔分组中

#### Scenario: Capability icon opens unified hub

- **WHEN** 用户点击 rail“能力”图标
- **THEN** 工作台上方展示 Capability Hub 全屏 overlay
- **AND** Hub 默认激活“专家”Tab
- **AND** 底层 Agent 会话状态保留

#### Scenario: Close hub returns to workbench

- **WHEN** 用户按 Esc 或点击 Hub 关闭
- **THEN** overlay 关闭且回到先前 Agent 视图
