# work-surface Specification

## Purpose

定义工作台右栏 Work Surface：默认文档态，任务产物进入审阅态；与左侧 Agent 意图栏联动。

## Requirements

### Requirement: Surface mode state machine

右栏 MUST 支持模式 `doc` | `review`；MAY 预留 `workflow`（本期可不实现交互）。默认 MUST 为 `doc`。

#### Scenario: Default is document

- **WHEN** 用户进入 Agent 模式且无待审 draft Artifact
- **THEN** 右栏为文档编辑区（既有 editor-pane 行为）

#### Scenario: Enter review on draft

- **WHEN** 当前 Session/Run 新增或激活一个 `status: draft` 的 Artifact
- **THEN** 右栏切换为 `review`，展示该产物审阅面

#### Scenario: Return to document

- **WHEN** 用户在审阅面点击「回到文档」（或等价控件）
- **THEN** 模式回到 `doc`，恢复此前焦点文件/空态，不删除 Artifact

### Requirement: Review surface contents

`review` 态 MUST 展示：标题、类型、正文或结构化预览、目标路径（若有）、接受与拒绝；MAY 提供编辑后接受。

#### Scenario: Accept from review

- **WHEN** 用户在右栏点击接受且产物含合法写入目标（或 `editor_patch` 有活动编辑器）
- **THEN** 按 `agent-run` 语义落盘或应用到编辑器，状态变为 `accepted`，并提示成功

#### Scenario: Reject from review

- **WHEN** 用户在右栏点击拒绝
- **THEN** 状态变为 `rejected`，磁盘不被该产物修改；可保持或退出 `review`

### Requirement: Open from transcript

左栏产物摘要卡 MUST 提供「在右侧打开」；点击后 MUST 进入 `review` 并聚焦该 Artifact。

#### Scenario: Reopen artifact

- **WHEN** 用户点击摘要卡「在右侧打开」
- **THEN** 右栏为 `review` 且展示对应 `artifactId`

### Requirement: Mode chrome

`review`（及未来 `workflow`）态 MUST 有可见模式指示，且 MUST 提供回到文档的入口。

#### Scenario: Mode visible

- **WHEN** 右栏处于 `review`
- **THEN** 用户可辨识当前为审阅（非普通编辑），并能一键回文档
