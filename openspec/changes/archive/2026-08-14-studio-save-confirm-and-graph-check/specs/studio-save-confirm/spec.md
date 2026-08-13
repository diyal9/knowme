## ADDED Requirements

### Requirement: Studio save opens confirm dialog before persist

画布「保存」SHALL 先打开保存确认弹层；仅在用户确认后才调用保存落盘。弹层 SHALL 展示可编辑的工作流目标（不得使用会话 `pendingGoal` 污染）、多列协作节点摘要，以及统一在页脚的「返回修改 / 确认保存」。

#### Scenario: Save from toolbar shows confirm first

- **WHEN** 用户点击工作室工具栏保存
- **THEN** 先出现保存确认弹层且尚未落盘
- **AND** 用户点「确认保存」后才写入「我的」工作流

#### Scenario: Goal is editable workflow goal

- **WHEN** 打开保存确认弹层
- **THEN** 目标输入框展示并允许编辑 `studioDraft.goal`
- **AND** 不展示会话残留意图作为只读目标

#### Scenario: Collaboration nodes use multi-column layout

- **WHEN** 协作节点 ≥ 2
- **THEN** 节点以不少于两列的网格展示
- **AND** 页脚操作按钮成组，正文内无游离「保存为我的工作流」按钮
