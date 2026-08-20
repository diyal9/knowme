## ADDED Requirements

### Requirement: Expert collaboration is one professional Agent task
The system SHALL show an expert capability detail before creating one formal task and SHALL NOT allow that task to delegate to another Agent.

#### Scenario: Expert work exceeds one node
- **WHEN** the expert determines that multiple professional roles and fixed handoffs are required
- **THEN** the system presents a workflow draft for confirmation without silently adding another Agent

### Requirement: Workflow is a multi-Agent process
The system SHALL require at least two Agent nodes with an explicit handoff relationship before a workflow can be published or started.

#### Scenario: Start a normal workflow
- **WHEN** the user confirms inputs on a valid workflow package
- **THEN** the system creates a Workflow v2 Root Run and does not call the Daemon pipeline launcher

### Requirement: Team workflows remain stable assets
The system SHALL keep team-provided workflows read-only and SHALL create a personal copy before editing.

#### Scenario: Edit a team workflow
- **WHEN** the user chooses to customize a team workflow
- **THEN** the original remains unchanged and the editor opens a personal fork
