## ADDED Requirements

### Requirement: Goal submission MUST create a resumable preparation context

首页提交目标后，工作台 MUST 保留目标文本并创建任务草稿，草稿至少包含目标、当前模式、推荐或选中的工作流和准备阶段。目标未匹配工作流时，工作台 MUST 展示可选工作流或能力入口，而不是清空目标并只显示无上下文的搜索结果。

#### Scenario: User submits a goal from the home page

- **WHEN** the user submits a non-empty goal
- **THEN** the workbench MUST keep the goal in the task draft and show a preparation state with a next action
- **AND** the user MUST be able to select a workflow without retyping the goal

#### Scenario: User opens team or capability setup from preparation

- **WHEN** the user leaves preparation to manage an Agent team or install a capability
- **THEN** the workbench MUST preserve the task draft
- **AND** returning to the workbench MUST show the same goal and selected workflow

### Requirement: Launch confirmation MUST be truthful

启动确认 MUST 在任务创建和启动请求成功后才将任务显示为已开始。任何启动异常、超时、授权失败或协议错误 MUST leave the task in a recoverable error state with a visible next action.

#### Scenario: Daemon launch succeeds

- **WHEN** task creation and run requests both succeed
- **THEN** the workbench MUST enter the running state with the returned task slug
- **AND** the recent-task projection MUST be refreshed

#### Scenario: Daemon launch fails

- **WHEN** task creation or run request fails
- **THEN** the workbench MUST NOT display the task as started or completed
- **AND** the preparation state MUST remain available for retry or editing

### Requirement: Task terminal states MUST be rendered distinctly

工作台 MUST distinguish successful, failed, cancelled, waiting and active task states. `terminal` MUST only stop polling; it MUST NOT imply success.

#### Scenario: Task finishes successfully

- **WHEN** the task state is `finished`, `completed`, `done` or `success`
- **THEN** the workbench MUST show a completed state
- **AND** it MUST fetch and display available artifacts

#### Scenario: Completed task has artifacts

- **WHEN** a successful terminal task has one or more normalized file or URL artifacts
- **THEN** the workbench MUST present those artifacts as the primary result
- **AND** the completed collaboration surface MUST NOT display internal factual-brief lines or active gate/clarification guidance

#### Scenario: Completed task has no artifacts

- **WHEN** a successful terminal task has no usable artifact after terminal refresh
- **THEN** the workbench MUST display “已完成 · 无产物”
- **AND** it MUST provide actions to inspect the execution process and run again
- **AND** it MUST NOT imply that a deliverable was produced

#### Scenario: Task fails or is cancelled

- **WHEN** the task state is `failed`, `error`, `rejected` or `cancelled`
- **THEN** the workbench MUST stop polling and show the corresponding failure/cancelled state
- **AND** it MUST provide a truthful restart or detail action
- **AND** it MUST NOT show a completed success label

### Requirement: Waiting tasks MUST expose the next human action

审批和澄清等待态 MUST 保留当前任务状态，并显示可执行的下一步。提交 gate 或 clarification 失败时，工作台 MUST 保持等待态并显示错误，不得伪造提交成功。

#### Scenario: Task waits for a gate

- **WHEN** the task projection contains a pending gate
- **THEN** the runner MUST show approve, revise and reject actions
- **AND** successful decisions MUST refresh the same task

#### Scenario: Task waits for clarification

- **WHEN** the task projection contains a clarification question
- **THEN** the runner MUST show the question and answer action
- **AND** an empty answer or failed request MUST leave the clarification visible

### Requirement: Recent tasks MUST be actionable and recover after reload

首页和任务页最近任务 MUST use the same state labels and next-action semantics. Task completion or failure MUST refresh the list. Reloading the application MUST allow a Daemon task from the list to be reopened and projected again.

#### Scenario: User selects a recent task

- **WHEN** the user selects a task in the home or task view
- **THEN** the workbench MUST open its current state, next action and artifacts

#### Scenario: User reloads after a Daemon task was created

- **WHEN** the application reloads and the Daemon task remains in the service task list
- **THEN** the user MUST be able to reopen it
- **AND** the workbench MUST fetch current task status before rendering it as complete or failed

### Requirement: Artifact actions MUST respect artifact type

工作台 MUST distinguish local file artifacts from remote links and MUST show a friendly fallback when an artifact path is missing, unsafe or unavailable.

Artifact projection MUST preserve explicit backend artifacts and normalize recognizable file and URL outputs from Agent Graph, local-team and Daemon terminal responses. Input paths and plain execution logs MUST NOT be promoted as artifacts.

#### Scenario: User opens a local artifact

- **WHEN** an artifact has a validated local path
- **THEN** the workbench MUST use the existing artifact-open IPC

#### Scenario: User opens an unavailable artifact

- **WHEN** an artifact has no usable local path or remote URL
- **THEN** the workbench MUST show an error state without crashing or opening an arbitrary path

#### Scenario: Backend returns a recognizable terminal output

- **WHEN** a supported execution backend returns a file path, URL or structured artifact in its terminal result
- **THEN** the workbench MUST retain it in the unified task artifact projection
- **AND** reopening or rendering the task result MUST expose the same artifact

### Requirement: Existing Workbench protocol boundaries MUST remain intact

本 change MUST preserve the existing structured Workbench IPC and `/api/tasks` payloads. The implementation MUST NOT introduce an arbitrary request bridge or reuse `/agent/v1` cancel/resume endpoints for Workbench tasks.

#### Scenario: Static protocol regression

- **WHEN** the existing Workbench template and daemon client tests run
- **THEN** all existing structured IPC names and security assertions MUST remain valid
