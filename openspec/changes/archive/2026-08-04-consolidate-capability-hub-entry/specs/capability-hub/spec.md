## REMOVED Requirements

### Requirement: Rail icon entries open Capability Hub

**Reason**: 三个 rail 入口造成重复导航，并误导用户将三类能力理解为三个页面。

**Migration**: 使用单一“能力”入口进入 Hub，再通过页内 Tab 切换能力类型；既有 `?tab=` 深链保持兼容。

## ADDED Requirements

### Requirement: Unified capability entry uses in-page tabs

左侧 rail MUST 提供一个“能力”图标入口。点击该入口 MUST 打开统一 Capability Hub；Hub MUST 在同一页面内提供“专家”“技能”“MCP 连接器”三个顶部 Tab，并允许用户不离开页面地切换能力类型。

#### Scenario: Open Hub from unified capability icon

- **WHEN** 用户点击 rail“能力”图标
- **THEN** 全屏 Capability Hub 打开且“专家”Tab 为激活态
- **AND** 工作台主内容被 Hub 覆盖，Hub 可通过关闭按钮或 Esc 退出

#### Scenario: Switch capability type in page

- **WHEN** 用户点击“技能”或“MCP 连接器”Tab
- **THEN** Hub 保持打开并切换当前能力类型的卡片、筛选和操作
- **AND** 当前 Tab 具有可感知的选中态与正确的无障碍状态

#### Scenario: Deep link preserves tab

- **WHEN** 用户从 Agent 空状态或其他既有深链打开指定能力类型
- **THEN** Hub 初始 Tab 与深链类型一致
- **AND** 随后的 Tab 切换仍在同一 Hub 页面完成
