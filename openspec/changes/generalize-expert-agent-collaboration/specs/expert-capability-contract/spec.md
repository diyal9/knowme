## ADDED Requirements

### Requirement: Expert behavior is declared by capability contract

The system SHALL derive expert inputs, tools, connectors, routes, deliverables and completion rules from a versioned capability manifest and SHALL NOT require a platform identity branch for a new expert with an existing capability combination.

#### Scenario: Third-party expert reuses an existing provider adapter

- **WHEN** an arbitrary expert declares a required tool and allows the adapter's connector
- **THEN** the system projects the same adapter without checking the expert ID

### Requirement: Real artifacts gate artifact-backed completion

The system SHALL enter review only after artifact count, artifact type, tool evidence and completion conditions satisfy the selected deliverable contract.

#### Scenario: Tool returns text without a required image

- **WHEN** an image deliverable tool call reports success but returns no readable image Artifact
- **THEN** the task enters an actionable non-complete state and no image or file preview is fabricated

#### Scenario: Multiple artifacts are required

- **WHEN** a deliverable requires two artifacts and only one valid artifact is returned
- **THEN** the task remains outside review and reports the expected and actual count

### Requirement: Conversation and artifacts have separate presentation contracts

The system SHALL render normal expert answers in the conversation and SHALL render only explicit files or media through the shared Artifact Preview contract.

#### Scenario: Text expert completes a task

- **WHEN** the declared output type is `answer` and the user did not request a file
- **THEN** the complete result appears as an expert dialogue response without a document card

#### Scenario: Image expert returns one or more images

- **WHEN** valid image Artifacts are returned
- **THEN** ordered thumbnails and a contained full preview are shown separately from status, explanation and acceptance controls

### Requirement: Review uses one continuous composer

The system SHALL keep one task composer available for clarification, execution supplements, review feedback and post-completion discussion.

#### Scenario: User requests a revision

- **WHEN** one pending deliverable exists and the user submits modification text
- **THEN** the text is sent directly as review feedback without opening a second editor

#### Scenario: Multiple deliverables await review

- **WHEN** multiple pending deliverables exist and no target is selected
- **THEN** the system asks the user to select a target and preserves the draft

### Requirement: Expert task state survives restart

The system SHALL persist the assignment snapshot, execution contract, all Artifact references, queued input and revision context without mutating task data during ordinary reads.

#### Scenario: Application restarts during execution or revision

- **WHEN** the application starts with an interrupted active expert task
- **THEN** the system resumes from persisted state and retains every prior Artifact needed for revision
