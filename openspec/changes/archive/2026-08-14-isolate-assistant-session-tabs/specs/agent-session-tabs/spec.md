## ADDED Requirements

### Requirement: Assistant tabs exclude workbench-owned sessions

助理模式 Session Tab 栏 MUST 仅展示助理 surface 打开的 Session。工作台任务、Daemon 协作、专家任务对话房、工作流对话房产生的 Session MUST NOT 出现在助理 Tab 栏。

#### Scenario: Open workbench expert task then switch to assistant

- **WHEN** 用户在工作台创建专家任务对话并随后进入助理模式
- **THEN** 助理 Tab 栏不新增该专家任务 Session
- **AND** 原有助理 Tabs 保持不变

#### Scenario: Open workflow dialogue then switch to assistant

- **WHEN** 用户从工作流货架进入工作流对话房并随后进入助理模式
- **THEN** 助理 Tab 栏不展示该工作流对话 Session

#### Scenario: Daemon or workbench task session title

- **WHEN** Session 目标或展示标题以「工作台 ·」开头，或绑定工作台任务引用
- **THEN** 该 Session MUST NOT 留在助理打开 Tab 集合中

#### Scenario: Capability hub start remains on assistant

- **WHEN** 用户从能力面/专家库在助理路径开始专家对话
- **THEN** 新 Session 仍出现在助理 Tab 栏

#### Scenario: Restart migrates polluted assistant tabs

- **WHEN** 用户重启应用且助理打开集合中仍含工作台归属 Session
- **THEN** 系统将这些 Session 移出助理打开集合并归入工作台打开集合
- **AND** 助理 Tab 栏不再展示它们
