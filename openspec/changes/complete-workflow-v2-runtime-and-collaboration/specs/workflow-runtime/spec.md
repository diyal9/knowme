## ADDED Requirements

### Requirement: Long-running workflows are recoverable
The system SHALL persist root runs, attempts and checkpoints and SHALL expose controlled pause and resume.

#### Scenario: Human node completes
- **WHEN** the assigned human submits formal input
- **THEN** a versioned output and checkpoint are stored before downstream work continues

### Requirement: Side effects are protected
High-risk or irreversible actions SHALL require a Gate and committed side effects SHALL NOT be silently repeated.

#### Scenario: Rerun committed side effect
- **WHEN** a user requests rerun without explicit side-effect confirmation
- **THEN** the runtime rejects the transition
