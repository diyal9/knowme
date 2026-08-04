# Delta Spec: workspace

## ADDED Requirements

### Requirement: Left rail capability icon entries

工作台左侧 rail MUST 新增三个仅图标入口：专家、技能、连接器。图标 MUST 有 tooltip 与 aria-label。点击 MUST 打开 Capability Hub 全屏层（见 capability-hub spec）。

#### Scenario: Three rail icons visible

- **WHEN** 用户进入 Agent 工作台
- **THEN** rail 显示专家/技能/连接器三个图标，风格与现有 rail 一致

#### Scenario: Icon opens hub overlay

- **WHEN** 用户点击 rail 专家图标
- **THEN** 工作台上方展示 Capability Hub 全屏 overlay
- **AND** 底层 Agent 会话状态保留

#### Scenario: Close hub returns to workbench

- **WHEN** 用户按 Esc 或点击 Hub 关闭
- **THEN** overlay 关闭且回到先前 Agent 视图

### Requirement: Hub visual consistency with workbench

Capability Hub MUST 使用浅色克制视觉，与 workbench chrome 协调；MUST NOT 引入与主界面冲突的深色主题（除非用户全局深色模式已启用且 Hub 跟随）。

#### Scenario: Light theme hub

- **WHEN** 用户处于默认浅色工作台
- **THEN** Hub 背景与卡片风格为浅色克制，参考元器式布局

### Requirement: Agent empty state and knowledge entry

当用户无已安装能力时，Agent 空状态 MUST 提供「打开能力 Hub」主 CTA，引导安装专家/技能/连接器；MAY 保留次要设置页入口但 MUST NOT 仅指向旧设置页技能创建。

#### Scenario: Empty state CTA to hub

- **WHEN** 新用户首次打开 Agent 且无已安装能力
- **THEN** 空状态含「打开能力 Hub」主 CTA
