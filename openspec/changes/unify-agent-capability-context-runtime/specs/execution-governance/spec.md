## ADDED Requirements

### Requirement: Side effects require valid prior authorization

#### Scenario: Pending operation
- **WHEN** an operation requires approval and no matching host approval exists
- **THEN** the operation handler MUST NOT run and the result MUST identify pending authorization

#### Scenario: Credential origin
- **WHEN** a connector request or redirect resolves outside the configured HTTP origin
- **THEN** the runtime MUST reject it without forwarding credentials

#### Scenario: Effective verification
- **WHEN** an effective execution contract is unsatisfied, including a dynamically activated Skill contract
- **THEN** the runtime MUST NOT emit a successful completion
