# unified-run-lifecycle

## Purpose

双轨（local-team Agent Graph、Daemon/Pipeline）运行态、HITL、取消与用户可见文案的统一投影。

## Requirements

### Requirement: Unified lifecycle projection

The system SHALL expose `projectRunLifecycle` that maps daemon task objects and local run status into a common `{ kind, hitlKind, outcomeLabel, compactLabel, tone, cancellable, terminal }` shape.

#### Scenario: HITL overrides completed job state

- **WHEN** a daemon task has `job.state=completed` and non-empty `pending_clarifications`
- **THEN** `kind` is `waiting`, `hitlKind` is `clarification`, and `outcomeLabel` is `等待你`

#### Scenario: Local gate waiting

- **WHEN** an agent-graph run has `pendingGates` and status `waiting`
- **THEN** `hitlKind` is `gate` and `outcomeLabel` is `等待你`

### Requirement: Daemon cancel API surface

The workbench daemon client SHALL provide `cancel(slug)` calling `POST /api/tasks/{slug}/cancel`, surfaced via IPC as `workbench-daemon-cancel`.

#### Scenario: User stops pipeline task

- **WHEN** user clicks Stop on an active daemon task room
- **THEN** the client invokes cancel API and the task projection becomes `cancelled`

### Requirement: Consistent compact labels

List rows and node meta labels SHALL use `compactLabel` from the unified projection for both backends.

#### Scenario: Active daemon run in task list

- **WHEN** task state is `running` without HITL
- **THEN** `compactLabel` is `进行中`

### Requirement: Cancellable detection

`cancellable` SHALL be true for non-terminal active or waiting runs on both backends.

#### Scenario: Terminal run not cancellable

- **WHEN** `kind` is `success`, `failure`, or `cancelled`
- **THEN** `cancellable` is false
