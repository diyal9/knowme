## REMOVED Requirements

### Requirement: Left rail capability icon entries

**Reason**: 专家、技能和连接器三个独立 rail 入口重复占位，且与统一 Capability Hub 的产品心智冲突。

**Migration**: 三个入口收敛为单一“能力”入口；原分类入口由 Hub 页内 Tab 承担。

## ADDED Requirements

### Requirement: Left rail provides one unified capability entry

工作台左侧 rail MUST 仅提供一个“能力”图标入口。图标 MUST 有 tooltip 与 aria-label。点击 MUST 打开 Capability Hub 全屏层（见 capability-hub spec），不得再将专家、技能和连接器作为三个独立 rail 入口展示。

#### Scenario: Single capability rail icon visible

- **WHEN** 用户进入 Agent 工作台
- **THEN** rail 仅显示一个“能力”图标入口
- **AND** rail 不再分别显示专家、技能、连接器三个图标

#### Scenario: Capability icon opens unified hub

- **WHEN** 用户点击 rail“能力”图标
- **THEN** 工作台上方展示 Capability Hub 全屏 overlay
- **AND** Hub 默认激活“专家”Tab
- **AND** 底层 Agent 会话状态保留

#### Scenario: Close hub returns to workbench

- **WHEN** 用户按 Esc 或点击 Hub 关闭
- **THEN** overlay 关闭且回到先前 Agent 视图
