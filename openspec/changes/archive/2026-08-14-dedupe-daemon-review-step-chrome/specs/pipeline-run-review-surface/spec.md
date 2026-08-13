## ADDED Requirements

### Requirement: Steps progress omits duplicate identity title

审阅「步骤」Tab 的进度块 MUST NOT 再渲染与顶栏相同的任务身份标题（如 `Daemon 阶段 · …`）。进度块 SHALL 仅展示步数/百分比摘要、当前节点摘要与进度条。

#### Scenario: Steps tab shows progress without repeating topbar title

- **WHEN** 用户打开 Daemon 管线运行的「步骤」Tab
- **THEN** 步骤区内不出现与顶栏同文的身份标题行
- **AND** 仍可见「已完成 n/m 步 · p%」类进度摘要与进度条

### Requirement: No tab recommendation copy in review chrome

审阅区 MUST NOT 展示「推荐查看「步骤/制品/变更/事件/过程日志」」类提示文案。失败或完成态仍 MAY 通过静默默认 Tab 引导用户，但 MUST NOT 用文案行提示。

#### Scenario: Failed run does not show recommendation line

- **WHEN** 任务状态为失败且当前 Tab 不是推荐 Tab
- **THEN** 审阅 Tab 栏下方不出现「推荐查看「过程日志」」或同类文案
- **AND** 默认激活 Tab 仍可按既有推荐逻辑选择
