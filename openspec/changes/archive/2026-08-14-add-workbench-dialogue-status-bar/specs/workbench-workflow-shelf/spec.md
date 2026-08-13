## ADDED Requirements

### Requirement: Workflow dialogue room shares dialogue status chrome

从货架进入工作流对话房时，系统 MUST 在左侧对话列展示与运行/专家对话房同构的状态栏（工作流短名或任务目标 + 返回）。返回 MUST 回到货架或任务房约定退路，MUST NOT 中断已登记进行中运行的语义（与现有 `backToRunList` / 任务房返回约定一致）。货架主入口仍 MUST 进入双栏对话房，MUST NOT 回退到居中详情弹层作为主路径。

#### Scenario: Open workflow dialogue shows status bar then back

- **WHEN** 用户从货架打开工作流对话房
- **THEN** 左栏顶显示工作流短名或任务目标
- **AND** 激活返回后回到货架（或约定退路）
- **AND** 不出现以详情弹层替代对话房的主路径回退
