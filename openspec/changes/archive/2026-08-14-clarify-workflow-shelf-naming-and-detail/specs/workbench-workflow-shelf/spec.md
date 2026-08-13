## ADDED Requirements

### Requirement: Shelf titles use outcome-oriented display names without mutating package names

工作流货架、运行视图标题与「管理我的工作流」列表 MUST 展示结果导向的短名，MUST NOT 直接把含 `→` / `—` / `->` 的管道式内部名原样作为主标题。展示层 MUST 去掉名称末尾的「（我的版本）」类冗余后缀，并继续用「团队 / 我的」角标表达归属。系统 MUST NOT 为了短名而改写持久化的 `workflow-package.name`。

#### Scenario: Pipeline-style internal name becomes short display title

- **WHEN** 某工作流持久化名为「会议资料 → 纪要与待办」或等价管道公式，并出现在货架
- **THEN** 卡片主标题显示结果导向短名（如「会议纪要与待办」）
- **AND** 该工作流在存储中的 `name` 仍为原内部名

#### Scenario: Fork suffix is not repeated in the title

- **WHEN** 某「我的」工作流持久化名以「（我的版本）」结尾
- **THEN** 货架与详情标题不展示该后缀
- **AND** 卡片仍显示「我的」来源角标

#### Scenario: Search still matches internal and display names

- **WHEN** 用户在货架搜索框输入内部名片段或展示短名片段
- **THEN** 对应工作流仍可被筛选出来

### Requirement: Clicking a shelf card opens a workflow dialogue workbench

> Superseded by `open-workflow-dialogue-workbench`：货架主入口为双栏工作流对话房，不再以居中详情弹层为主路径。展示层短名规则（本文件上文）仍然有效。

用户点击货架卡片空白区域时，系统 MUST 打开工作台双栏工作流对话房（左对话、右工作流属性）。系统 MUST NOT 以居中详情弹层作为主入口。

#### Scenario: Open dialogue from card body

- **WHEN** 用户点击某张货架卡片的空白区域（非页脚操作按钮）
- **THEN** 系统进入工作流对话房
- **AND** 不打开居中详情弹层作为主结果

### Requirement: Secondary shelf actions use icon buttons without stealing the primary entry

货架卡片页脚次要操作（编辑 / 复制并调整）MUST 使用图标按钮并提供 `title` / `aria-label`。点击这些图标 MUST 只触发对应动作，MUST NOT 打开工作流对话房。运行入口为 play 图标，点击后进入对话房（见 `open-workflow-dialogue-workbench`）。

#### Scenario: Secondary action clicks do not open dialogue

- **WHEN** 用户点击编辑或复制等次要图标按钮
- **THEN** 系统执行对应动作
- **AND** 不打开工作流对话房

#### Scenario: Secondary actions are icon-only with accessible names

- **WHEN** 用户查看团队工作流卡片
- **THEN** 「复制并调整」以图标按钮呈现，并带有可访问名称「复制并调整」或「复制为我的版本」
