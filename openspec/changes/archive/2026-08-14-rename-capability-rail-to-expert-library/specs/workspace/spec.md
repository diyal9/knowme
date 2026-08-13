## ADDED Requirements

### Requirement: Expert library is the user-facing name for Capability Hub

KnowMe 对外 MUST 将统一 Capability Hub（专家 / 技能 / MCP 连接器）称为「专家库」。左侧 rail 入口、Hub 品牌标题、宿主 center surface / iframe 标题，以及指向该面的工作台 CTA、空态、toast、设置引导 MUST 使用「专家库」，MUST NOT 再向用户展示「能力 Hub」「能力界面」「能力中心」作为该模块名。代码标识符与 IPC（如 `capability-hub`、`btnRailCapabilities`）MAY 保持不变。

#### Scenario: Left rail shows 专家库

- **WHEN** 用户查看工作台左侧主导航
- **THEN** `#btnRailCapabilities` 的可见标签、title 显示「专家库」
- **AND** aria-label 以「专家库」开头并说明含专家、技能与连接器

#### Scenario: Hub chrome uses 专家库

- **WHEN** 用户打开统一 Capability Hub
- **THEN** 宿主标题与 Hub 顶栏品牌文案显示「专家库」
- **AND** 用户可见 UI 不出现「能力 Hub」字样

#### Scenario: Cross-surface CTAs use 专家库

- **WHEN** 工作台或设置引导用户前往安装/调优专家或打开该面
- **THEN** 按钮与提示文案使用「专家库」（例如「去专家库添加专家」）
- **AND** 不使用「能力界面」「能力中心」「能力 Hub」作为模块名

## MODIFIED Requirements

### Requirement: Left rail provides one unified capability entry

工作台左侧 rail MUST 仅提供一个「专家库」图标入口。图标 MUST 有 tooltip 与 aria-label。点击 MUST 打开 Capability Hub 全屏层（见 capability-hub spec），不得再将专家、技能和连接器作为三个独立 rail 入口展示。专家库入口 MUST 紧随工作台入口，并位于自动化入口上方的主导航分组中；自动化入口 MUST 位于其后的分隔分组。

#### Scenario: Single capability rail icon visible

- **WHEN** 用户进入 Agent 工作台
- **THEN** rail 仅显示一个「专家库」图标入口
- **AND** rail 不再分别显示专家、技能、连接器三个图标

#### Scenario: Capability and automation use the requested order

- **WHEN** 用户查看工作台左侧 rail
- **THEN** 专家库入口紧随工作台入口显示
- **AND** 自动化入口显示在专家库入口下方的分隔分组中

#### Scenario: Capability icon opens unified hub

- **WHEN** 用户点击 rail「专家库」图标
- **THEN** 工作台上方展示 Capability Hub 全屏 overlay
- **AND** Hub 默认激活「专家」Tab
- **AND** 底层 Agent 会话状态保留

#### Scenario: Close hub returns to workbench

- **WHEN** 用户按 Esc 或点击 Hub 关闭
- **THEN** overlay 关闭且回到先前 Agent 视图

### Requirement: Agent empty state prioritizes work tasks

Agent 空状态 MUST 以任务与知识入口为主，不得显示「打开能力 Hub」或「打开专家库」作为空状态主卡片；工作台 SHALL 保持左侧专家库、知识网与设置入口位置清晰且不得恢复独立片段库。

#### Scenario: Empty agent shows task and knowledge entry

- **WHEN** Agent 列无消息
- **THEN** 空状态以任务/知识入口为主（含知识管家模板）
- **AND** 不得显示「打开能力 Hub」卡片
- **AND** 不得仅显示单一聊天提示

#### Scenario: Open capability hub from unified rail entry

- **WHEN** 用户点击左侧 rail「专家库」入口
- **THEN** 打开统一 Capability Hub
