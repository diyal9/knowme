## ADDED Requirements

### Requirement: Studio toolbar actions are icon-first

编排画布顶栏右侧动作 MUST 以图标按钮展示「模式切换 / 保存 / 测试运行」，并 MUST 通过 `title` 与 `aria-label` 提供与原先一致的中文含义。

#### Scenario: Icon actions remain operable

- **WHEN** 用户打开编排工作流专业画布或轻量步骤
- **THEN** 右侧可见三个图标按钮，点击分别切换模式、保存、测试运行
- **AND** 悬停或读屏能识别「轻量步骤/专业画布」「保存」「测试运行」

### Requirement: Left layout tools for free canvas

专业画布顶栏左侧 MUST 提供编排辅助工具，至少包含：一键整理、左对齐、顶对齐、水平居中、适应画布。轻量步骤模式下这些布局工具 MUST 隐藏或禁用。

#### Scenario: One-click tidy layout

- **WHEN** 用户在专业画布点击「一键整理」且画布上存在节点
- **THEN** 系统按自动布局重写节点坐标并标记草稿未保存
- **AND** 视口适应整理后的画布

#### Scenario: Align nodes

- **WHEN** 用户点击左对齐 / 顶对齐 / 水平居中
- **THEN** 目标节点集合（当前选中 ≥2 时为选中集；否则为全部可布局节点）在对应轴上对齐
- **AND** 草稿标记为未保存并刷新画布

#### Scenario: Fit viewport from toolbar

- **WHEN** 用户点击工具栏「适应画布」
- **THEN** 视口缩放与平移与现有右下角适应行为一致
