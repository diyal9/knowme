## MODIFIED Requirements

### Requirement: Save and reuse composition

用户 MUST 能将通过校验的 Graph 保存为个人 Workflow Package，并能从已有流程复制后继续修改；保存内容 MUST 包含 Agent、Skill 和权限快照。保存成功后工作流 MUST 立即出现在货架「我的」来源数据中（无需手动刷新）。工具栏「保存」成功后 MUST 留在编排工作室，MUST NOT 自动切到工作流货架首页；仅当用户通过返回/离开确认选择离开（含「保存后离开」）时，才 MUST 导航回货架。

当编排为自由图画布时，保存 MUST 持久化节点画布坐标（含开始/结束与业务节点）；保存成功后重新渲染或再次打开编辑时，节点位置 MUST 与保存前一致。一键对齐后的坐标 MUST 被保存。缺少布局信息的旧包打开时 MAY 回退为自动排布。

#### Scenario: Save personal workflow

- **WHEN** 用户确认一个有效 Graph 并保存
- **THEN** 系统创建个人工作流草稿，保留目标、Graph 和能力版本信息

#### Scenario: Toolbar save stays in studio

- **WHEN** 用户在编排工作室点击工具栏「保存」且校验与持久化成功
- **THEN** 系统仍显示编排工作室，草稿标记为已保存，且不切换到工作流货架首页

#### Scenario: Save then leave returns to shelf

- **WHEN** 用户在离开确认中选择「保存后离开」且保存成功
- **THEN** 系统导航回工作流货架，并清空编排内存草稿

#### Scenario: Canvas layout survives save

- **WHEN** 用户在自由图画布调整或一键对齐节点位置后保存成功
- **THEN** 保存的工作流 Graph 含布局坐标，且当前编排画布仍显示保存前的节点位置
