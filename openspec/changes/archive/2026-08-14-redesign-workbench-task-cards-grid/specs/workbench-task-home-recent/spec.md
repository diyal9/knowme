## MODIFIED Requirements

### Requirement: Recent tasks preview by default

工作台任务首页的「你的任务」MUST 以卡片网格展示，并在默认状态下仅展示有限条最近任务（预览条数）。宽屏下 MUST 按三列排布（窄屏可降为两列或一列）。收起态下，常见窗口高度内任务首页 MUST NOT 因最近任务预览区而需要页面级上下滚动；快捷任务与最近任务预览 MUST 同屏可见。

#### Scenario: Few tasks show all without toggle

- **WHEN** 最近任务数量小于或等于预览条数
- **THEN** 系统以卡片网格展示全部任务，且不显示「更多」切换控件

#### Scenario: Many tasks collapse by default

- **WHEN** 最近任务数量大于预览条数且用户尚未展开
- **THEN** 系统仅展示预览条数的任务卡片，并显示可点击的「更多」控件（含剩余数量提示）

#### Scenario: Collapsed preview fits without page scroll

- **WHEN** 最近任务处于收起预览态且窗口为常见桌面高度
- **THEN** 用户无需对任务首页做页面级上下滚动即可看到快捷任务区与最近任务预览

### Requirement: Expand and collapse remaining tasks

用户 MUST 能通过「更多 / 收起」在预览与完整列表之间切换。

#### Scenario: Expand shows remaining tasks

- **WHEN** 用户点击「更多」
- **THEN** 系统展示全部最近任务卡片，控件文案变为「收起」，且 `aria-expanded` 为 true

#### Scenario: Collapse returns to preview

- **WHEN** 列表已展开且用户点击「收起」
- **THEN** 系统回到仅展示预览条数，控件文案回到「更多」，且 `aria-expanded` 为 false

### Requirement: Scrollable task list when content overflows

展开后的「你的任务」列表容器 MUST 支持上下滚动，以便浏览超出可视区域的任务卡片。仅在展开更多后，才允许因完整任务列表而产生滚动；收起预览态 MUST 优先避免页面级滚动。

#### Scenario: Expanded list scrolls

- **WHEN** 展开后任务卡片高度超过列表可视区域
- **THEN** 用户可通过列表容器纵向滚动查看全部任务卡片

#### Scenario: Empty state unchanged

- **WHEN** 没有任何最近任务
- **THEN** 系统显示既有空态文案，不显示「更多」控件

## ADDED Requirements

### Requirement: Task card shows execution summary

每张最近任务卡片 MUST 展示任务执行摘要文本：优先使用已持久化的结果摘要；若无则使用任务目标；若仍无则使用基于状态的短说明。摘要 MUST 截断为有限行数，避免单卡无限增高。

#### Scenario: Card shows goal as summary fallback

- **WHEN** 任务没有结果摘要但有目标文案
- **THEN** 卡片摘要区域展示该目标文案（截断显示）

#### Scenario: Card shows status fallback when no text

- **WHEN** 任务既无结果摘要也无目标文案
- **THEN** 卡片摘要区域展示与当前状态对应的短说明

#### Scenario: Scheduled mark on card

- **WHEN** 任务已启用计划
- **THEN** 最近任务卡片以非交互时钟图标标记已设定时（悬停可见计划说明），不展示行内「定时」操作按钮

#### Scenario: Schedule managed from header entry

- **WHEN** 用户点击任务页右上角「定时任务」（图标 + 文字）
- **THEN** 系统打开任务定时面板以选择/编辑计划

### Requirement: Quick experts preview one row

「安排专家执行任务」快捷专家卡 MUST 以与最近任务一致的三列网格展示（窄屏可降列）。默认 MUST 仅展示一排预览条数；超出时 MUST 提供「更多 / 收起」，展开后方可操作其余专家。收起态 MUST NOT 因多排专家而迫使任务首页页面级滚动。

#### Scenario: Few experts show all without toggle

- **WHEN** 快捷专家数量小于或等于一排预览条数
- **THEN** 系统展示全部专家卡，且不显示「更多」控件

#### Scenario: Many experts collapse to one row

- **WHEN** 快捷专家数量大于一排预览条数且用户尚未展开
- **THEN** 系统仅展示一排预览条数的专家卡，并显示「更多」控件（含剩余数量）

#### Scenario: Expand reveals remaining experts

- **WHEN** 用户点击快捷专家区的「更多」
- **THEN** 系统展示全部快捷专家卡，控件变为「收起」，用户可点击任意专家卡开始任务
