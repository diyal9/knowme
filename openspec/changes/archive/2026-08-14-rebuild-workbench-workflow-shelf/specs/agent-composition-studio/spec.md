## MODIFIED Requirements

### Requirement: Save and reuse composition

用户 MUST 能将通过校验的 Graph 保存为个人 Workflow Package，并能从已有流程复制后继续修改；保存内容 MUST 包含 Agent、Skill 和权限快照。保存后的工作流 MUST 立即出现在货架的「我的」来源下，无需用户手动刷新或切换视图。

#### Scenario: Save personal workflow

- **WHEN** 用户确认一个有效 Graph 并保存
- **THEN** 系统创建个人工作流草稿，保留目标、Graph 和能力版本信息

#### Scenario: Saved workflow reaches the shelf

- **WHEN** 用户在编排工作室保存一个有效工作流并返回货架
- **THEN** 该工作流出现在货架的「我的」来源下，卡片显示其产出、所需输入与可运行状态

### Requirement: Dedicated composition workspace

编排工作室 MUST 作为货架页的次级入口提供，MUST NOT 与货架平级占据一级导航。工作室 MUST 展示 Graph 结构、节点检查器、校验问题、执行预览、保存和复制动作；不得只依赖一次性确认弹窗承载编辑。工作室的常驻布局 MUST NOT 超过两栏，节点检查器等辅助面板 MUST 以按需展开的形式呈现，而非常驻第三栏。

#### Scenario: Revise a generated graph

- **WHEN** 用户从目标生成 Graph 草案后选择继续编排
- **THEN** 工作室保留目标和草案，允许选择节点查看职责、Profile、Skill、权限、输入输出和连接关系，并在修改后重新校验

#### Scenario: Inspector does not occupy a third column

- **WHEN** 用户打开编排工作室但未选中任何节点
- **THEN** 界面为不超过两栏的布局，节点检查器不占据常驻空间；选中节点后检查器按需出现

#### Scenario: Entered from the shelf

- **WHEN** 用户需要编排一个新工作流
- **THEN** 从货架页的管理入口进入工作室，退出后回到货架
