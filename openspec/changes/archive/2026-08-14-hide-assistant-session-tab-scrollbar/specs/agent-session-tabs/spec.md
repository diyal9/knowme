## ADDED Requirements

### Requirement: Session tab strip scrolls without visible scrollbar

Session Tab 列表溢出时，系统 MUST 隐藏可见横向滚动条，并 MUST 允许用户用鼠标滚轮（或触控板滚动手势）横向浏览被遮挡的 Tab。

#### Scenario: Overflow tabs hide the scrollbar

- **WHEN** 打开的 Session Tab 宽度超过顶栏可用宽度
- **THEN** Tab 条区域不显示可见的横向滚动条
- **AND** Tab 内容仍可水平滚动以露出被遮挡的 Tab

#### Scenario: Mouse wheel pans the tab strip

- **WHEN** 指针位于 Session Tab 条上且 Tab 已水平溢出
- **AND** 用户滚动鼠标滚轮（或触控板等效手势）
- **THEN** Tab 列表沿水平方向移动
- **AND** 对话区内容不因该次滚轮而纵向滚动
