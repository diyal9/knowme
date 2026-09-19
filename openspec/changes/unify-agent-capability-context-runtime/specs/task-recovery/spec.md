## ADDED Requirements

### Requirement: Recoverable tasks preserve user decisions and evidence

#### Scenario: Reopen task
- **WHEN** an existing task is reopened
- **THEN** confirmed goals and queued attachment associations MUST remain intact without fabricated user messages or execution evidence

#### Scenario: User decision pending
- **WHEN** authorization, input, selection or acceptance is pending
- **THEN** the runtime MUST distinguish that wait and MUST NOT automatically execute dependent operations

#### Scenario: Uncertain side effect
- **WHEN** an external write result is unknown
- **THEN** the runtime MUST verify its outcome before considering replay
