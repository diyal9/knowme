## ADDED Requirements

### Requirement: Recent tasks preview by default

工作台任务首页的「你的任务」列表 MUST 在默认状态下仅展示有限条最近任务（预览条数），使快捷任务与最近任务摘要能在常见窗口高度下同屏可见。

#### Scenario: Few tasks show all without toggle

- **WHEN** 最近任务数量小于或等于预览条数
- **THEN** 系统展示全部任务行，且不显示「更多」切换控件

#### Scenario: Many tasks collapse by default

- **WHEN** 最近任务数量大于预览条数且用户尚未展开
- **THEN** 系统仅展示预览条数的任务行，并显示可点击的「更多」控件（含剩余数量提示）

### Requirement: Expand and collapse remaining tasks

用户 MUST 能通过「更多 / 收起」在预览与完整列表之间切换。

#### Scenario: Expand shows remaining tasks

- **WHEN** 用户点击「更多」
- **THEN** 系统展示全部最近任务行，控件文案变为「收起」，且 `aria-expanded` 为 true

#### Scenario: Collapse returns to preview

- **WHEN** 列表已展开且用户点击「收起」
- **THEN** 系统回到仅展示预览条数，控件文案回到「更多」，且 `aria-expanded` 为 false

### Requirement: Scrollable task list when content overflows

展开后的「你的任务」列表 MUST 支持上下滚动，以便浏览超出可视区域的任务行；任务首页容器亦 MUST 保留页面级纵向滚动兜底。

#### Scenario: Expanded list scrolls

- **WHEN** 展开后任务行高度超过列表可视区域
- **THEN** 用户可通过列表纵向滚动查看全部任务行

#### Scenario: Empty state unchanged

- **WHEN** 没有任何最近任务
- **THEN** 系统显示既有空态文案，不显示「更多」控件
