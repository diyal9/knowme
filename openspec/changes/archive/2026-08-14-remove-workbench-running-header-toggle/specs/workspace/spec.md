## ADDED Requirements

### Requirement: Workbench header has no global running popover

工作台顶栏 MUST NOT 提供「进行中」全局按钮或其运行列表 popover。用户查看与恢复运行中事项 MUST 通过「任务」面列表和/或「管线服务」记录面完成，MUST NOT 依赖顶栏第二入口。

#### Scenario: Header omits running toggle

- **WHEN** 用户打开工作台任意一级 Tab（任务 / 工作流 / 管线服务）
- **THEN** 顶栏不出现「进行中」按钮、数量徽标或运行列表 popover

#### Scenario: Running items remain reachable from task or pipeline surfaces

- **WHEN** 存在运行中或最近任务 / 管线记录
- **THEN** 用户仍可在「任务」列表或「管线服务」记录（含进行中筛选）中看到并打开对应项
