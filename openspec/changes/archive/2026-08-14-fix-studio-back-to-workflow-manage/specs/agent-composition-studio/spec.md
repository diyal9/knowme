## MODIFIED Requirements

### Requirement: Save and reuse composition

用户 MUST 能将通过校验的 Graph 保存为个人 Workflow Package，并能从已有流程复制后继续修改；保存内容 MUST 包含 Agent、Skill 和权限快照。保存成功后工作流 MUST 立即出现在货架「我的」来源数据中（无需手动刷新）。工具栏「保存」成功后 MUST 留在编排工作室，MUST NOT 自动切到工作流货架首页；仅当用户通过返回/离开确认选择离开（含「保存后离开」）时，才 MUST 离开编排面。

离开编排时，系统 MUST 按进入来源恢复上一层：从「管理工作流」进入（或来源未知）时 MUST 回到管理工作流列表；仅当从工作流货架进入时 MUST 回到货架。MUST NOT 在管理入口场景下一律落到工作流货架首页。

#### Scenario: Save personal workflow

- **WHEN** 用户确认一个有效 Graph 并保存
- **THEN** 系统创建个人工作流草稿，保留目标、Graph 和能力版本信息

#### Scenario: Toolbar save stays in studio

- **WHEN** 用户在编排工作室点击工具栏「保存」且校验与持久化成功
- **THEN** 系统仍显示编排工作室，草稿标记为已保存，且不切换到工作流货架首页

#### Scenario: Leave from manage returns to workflow manage

- **WHEN** 用户从管理工作流进入编排，并点击返回或在离开确认中选择「保存后离开」且保存成功
- **THEN** 系统导航回管理工作流列表，并清空编排内存草稿

#### Scenario: Leave from shelf returns to shelf

- **WHEN** 用户从工作流货架进入编排，并显式离开编排
- **THEN** 系统导航回工作流货架，并清空编排内存草稿
