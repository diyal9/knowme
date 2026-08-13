## Purpose

管理最近任务弹窗支持按策略批量勾选，并以带专家头像与可折叠进度的任务卡片呈现，便于安全清理陈旧任务。

## ADDED Requirements

### Requirement: Selection strategies beside select-all

管理弹窗底栏 MUST 在「全选」旁提供选择策略控件，至少包含「超过 3 个月」；另 MUST 提供「已完成」「超过 1 个月」「清空」策略。策略只改变勾选状态，不直接删除。

#### Scenario: Select older than three months

- **WHEN** 用户点击「超过 3 个月」
- **THEN** 仅勾选 `updatedAt` 早于约 90 天的任务，其余取消勾选，并刷新删除按钮可用态

#### Scenario: Select completed tasks

- **WHEN** 用户点击「已完成」
- **THEN** 仅勾选状态为已完成的任务

#### Scenario: Clear selection

- **WHEN** 用户点击「清空」
- **THEN** 所有任务取消勾选，删除按钮禁用

### Requirement: Manage cards show expert with avatar

每条可管理任务卡片 MUST 展示专家头像与专家名称；头像优先使用专家目录中的预设图，缺失时回退语义图标。

#### Scenario: Card shows expert identity

- **WHEN** 用户打开管理弹窗且列表非空
- **THEN** 每张卡片可见头像标记与专家名（或「专家」兜底文案）

### Requirement: Task progress is toggleable

卡片上的任务进度详情 MUST 默认收起，MUST 提供 toggle 控件展开/收起进度摘要（结果摘要或目标）；状态标签本身仍可见。

#### Scenario: Expand progress

- **WHEN** 用户点击某卡片的进度 toggle
- **THEN** 该卡片展开进度详情，其它卡片状态不变

#### Scenario: Collapse progress

- **WHEN** 用户再次点击同一进度 toggle
- **THEN** 该卡片进度详情收起
