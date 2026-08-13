## ADDED Requirements

### Requirement: Shelf card footer exposes run only

工作流货架卡片 footer MUST 仅提供「开始运行」图标按钮。MUST NOT 在货架卡 footer 展示「复制并调整」或「编辑」图标按钮。

#### Scenario: Homepage card has single run action

- **WHEN** 用户在工作流首页查看可运行的工作流卡片
- **THEN** 卡片 footer 右侧仅见运行（play）图标按钮，不见复制或编辑图标

### Requirement: Manage card exposes copy beside edit

工作流维护管理卡 MUST 在编辑图标旁提供「复制」图标按钮（带 `title` / `aria-label`）。点击复制 MUST 基于该个人/派生工作流生成新的「我的」流程副本，并刷新管理列表与货架。

#### Scenario: Copy next to edit on manage card

- **WHEN** 用户打开「维护你自己的流程」且至少有一条个人工作流
- **THEN** 该卡右上角操作区在编辑图标旁可见复制图标，且删除图标仍在

#### Scenario: Copy creates personal duplicate

- **WHEN** 用户点击某管理卡的复制图标且 fork 成功
- **THEN** 列表中出现新的「我的」工作流，并提示复制成功

### Requirement: Manage card IO summary stacks as rectangular bars

工作流维护管理卡上的「输入」「产出」摘要 MUST 以上下两行全宽矩形背景条展示，MUST NOT 使用同行 pill/chip 并排布局。

#### Scenario: Stacked IO bars

- **WHEN** 用户打开「维护你自己的流程」并查看某张个人工作流卡
- **THEN** 「输入」与「产出」各占一行矩形条，垂直排列
