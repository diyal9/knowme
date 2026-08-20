## ADDED Requirements

### Requirement: Expert work is a formal task
The system SHALL start one private expert task after one confirmed brief and SHALL retain it if preflight fails.

#### Scenario: Missing input
- **WHEN** required material is absent
- **THEN** the task enters `needs_input` without losing the brief

### Requirement: Deliverables are versioned and reviewable
The system SHALL keep required deliverables, artifact references, versions, comments and acceptance state in the task record.

#### Scenario: Review each item
- **WHEN** a user accepts or requests changes on one deliverable
- **THEN** only that deliverable is updated and the task completes only after all required items are accepted
