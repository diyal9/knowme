## ADDED Requirements

### Requirement: Open orchestration from a personal workflow id

编辑「我的」流程 MUST 用该 package 的 graph 打开编排画布，MUST NOT 打开无关空白草稿。

#### Scenario: Edit my workflow

- **WHEN** 用户在管理工作流点击某卡的编辑
- **THEN** 编排标题为该流程名称，且 `sourceWorkflowId` 为该卡 id

#### Scenario: Create blank workflow

- **WHEN** 用户点击「+ 新建工作流」
- **THEN** 打开空白草稿，名称为「我的专家协作」

### Requirement: Leave studio returns to origin

离开编排 MUST 回到进入时的来源面；从管理工作流进入时 MUST 回到「我的工作流」列表，不得落到专家协作或管线服务。

#### Scenario: Return to workflow manage

- **WHEN** 用户从管理工作流进入编排后点击返回且草稿未脏
- **THEN** 工作台表面为 manage，面板为 workflows

### Requirement: Dirty leave offers save or discard

未保存且已有业务节点时，离开 MUST 提供取消、保存后离开、离开（丢弃）。

#### Scenario: Discard dirty draft

- **WHEN** 用户确认离开且选择丢弃
- **THEN** 草稿清空并回到来源面
