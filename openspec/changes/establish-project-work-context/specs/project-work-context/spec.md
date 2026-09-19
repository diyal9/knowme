## ADDED Requirements

### Requirement: Source-backed project registration
The system SHALL represent every writable local or repository work root as one stable Project without copying or moving user files.

#### Scenario: Migrate an existing source
- **WHEN** KnowMe reads an existing writable Content Source with no Project record
- **THEN** it creates one deterministic compatibility Project for that source and does not create duplicate active Projects for the same work root

### Requirement: One writable workspace
The system SHALL bind each V1 Project to exactly one primary writable `workspaceSourceId` and SHALL keep reference sources separate and read-only by default.

#### Scenario: Choose an output destination
- **WHEN** a task creates a new deliverable
- **THEN** the deliverable is written under the Project workspace output policy and never defaults to a reference source

### Requirement: Active project is navigation state
The system SHALL use `activeProjectId` only for navigation, filtering and new-entity defaults.

#### Scenario: Switch while an existing task is open
- **WHEN** the user switches `activeProjectId`
- **THEN** existing Session, Task, Run and Artifact ownership remains unchanged and their file access is not redirected

### Requirement: Stable task ownership
The system SHALL bind every task that reads, creates or modifies project files to a valid Project and resolve its workspace from that binding.

#### Scenario: Launch a file-producing task
- **WHEN** a file-producing task starts
- **THEN** it saves `projectId` and a run snapshot sufficient to trace the workspace source, repository version and output policy

### Requirement: Project-aware partner sessions
The system SHALL allow general sessions without a Project while requiring a stable Project binding before project file operations.

#### Scenario: First project file operation
- **WHEN** an unbound Session first requests a project file operation
- **THEN** the system determines and persists `projectId` before execution and later project switching does not alter it

### Requirement: Traceable artifacts
The system SHALL record project, source, relative path and origin for every persistent file created or modified by an Agent, workflow or automation.

#### Scenario: Show generated work in the project
- **WHEN** a persistent Artifact is produced
- **THEN** the Project surface can show it in a smart view while the physical file continues to exist at only one workspace path

### Requirement: Project-scoped automation
The system SHALL bind every automation that accesses project files, and each of its runs, to a target Project.

#### Scenario: Target project is unavailable
- **WHEN** a write-capable automation targets an archived, missing or readonly Project
- **THEN** the run is blocked with an actionable needs-attention state instead of silently writing elsewhere

### Requirement: Project-scoped Brain evidence
The system SHALL keep Brain global while allowing cognition and evidence to carry Project scope and stable Project references.

#### Scenario: Open evidence from Brain
- **WHEN** a user opens project evidence from Brain
- **THEN** KnowMe resolves the evidence with its own `projectId` rather than the currently selected Project

### Requirement: Safe project lifecycle
The system SHALL preserve user files and historical references when a Project is archived, missing or removed from KnowMe.

#### Scenario: Archive a project
- **WHEN** the user archives or detaches a Project
- **THEN** KnowMe does not delete workspace files, tasks, sessions, artifacts or Brain cognition

#### Scenario: Workspace cannot be reached
- **WHEN** the primary work root cannot be accessed
- **THEN** the Project enters `missing` and writes are blocked until the user relinks or restores it

### Requirement: Compatible project surface
The system SHALL expose the Project selector and real workspace tree through the existing file-side-panel interaction while preserving file operations.

#### Scenario: Open the Project entry
- **WHEN** the user opens the left-side Project entry
- **THEN** the panel shows the selected Project and its real file tree and may additionally show non-duplicating task/output smart views
