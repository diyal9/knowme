## Purpose

Defines how KnowMe projects Daemon pipeline task runtime status and HITL waiting so it matches Daemon WebUI pending/waiting semantics.

## ADDED Requirements

### Requirement: HITL waiting overrides completed projection

When a Daemon task has pending clarifications or gates, KnowMe MUST present the task as waiting for the user and MUST NOT present a completed outcome, even if `job.state` or a top-level done-like state is also present.

#### Scenario: Idle with pending clarifications

- **WHEN** task runtime metadata is `idle` (or similar non-failure) and `pending_clarifications` is non-empty
- **THEN** the run outcome label is waiting-for-user (e.g. 「等待你」) and progress MUST NOT show full completion (e.g. 12/12 · 100%) solely due to a done-like job state

#### Scenario: Completed job state without HITL

- **WHEN** the task has a done-like state and no pending clarifications or gates
- **THEN** KnowMe MAY show completed outcome as today

### Requirement: Runtime status source prefers status over job

KnowMe MUST resolve display/runtime state preferring `status.state` (process status) over stale `job.state` when both are present, and MUST treat pending HITL fields as authoritative for waiting.

#### Scenario: Job completed while status idle with clarify

- **WHEN** `job.state` is completed/finished and `status.state` is idle and clarifications are pending
- **THEN** resolved runtime state is waiting (not success/done) and `terminal` is false for polling purposes

### Requirement: Clarification UI remains actionable while waiting

While clarifications are pending, KnowMe MUST keep waitingKind as clarification (or gate for gates) so the dialogue HITL card can render and accept answers.

#### Scenario: Brief does not swallow clarification on success flags

- **WHEN** brief inputs include a clarification payload together with terminalKind success or status done
- **THEN** waitingKind is clarification and headline indicates waiting for user input
