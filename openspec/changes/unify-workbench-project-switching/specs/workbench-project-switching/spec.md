## ADDED Requirements

### Requirement: Shared workbench project selector
The system SHALL expose one visible Project selector across expert collaboration, workflows and pipeline services and SHALL use it to update the shared active Project navigation context.

#### Scenario: Switch project from the workbench
- **WHEN** the user selects another available Project in the workbench header
- **THEN** all workbench surfaces use that Project as their current navigation and new-entity context without changing ownership of existing entities

### Requirement: Project-oriented workspace entry
The system SHALL present the left workspace entry as a Project space while retaining the real workspace file tree for the selected Project.

#### Scenario: Start a local project
- **WHEN** the user opens or creates a local folder from the Project selector
- **THEN** KnowMe registers or resolves its Project, selects it and exposes its files without copying the folder

### Requirement: History scope is not execution context
The system SHALL use Current Project as the default workflow and pipeline history scope and MAY offer All Projects only as a read-only history filter.

#### Scenario: View all project records
- **WHEN** the user selects All Projects in a history surface
- **THEN** the surface shows cross-project records but new work still requires one concrete active Project

### Requirement: Pipeline launch has product project ownership
The system SHALL require a concrete active Project before preparing a pipeline launch and SHALL persist the product `projectId` in the launch intent.

#### Scenario: Prepare a pipeline task
- **WHEN** the user submits a valid pipeline task with an active Project
- **THEN** the prepared launch intent contains that Project identifier and the record can be resolved back to its KnowMe Project

#### Scenario: No active project
- **WHEN** the user attempts to create a pipeline task without an active Project
- **THEN** the action is blocked with guidance to select a Project

### Requirement: Safe project management
The system SHALL allow users to update Project metadata, relink missing workspaces, archive and restore Projects without deleting workspace files or historical entities.

#### Scenario: Archive from project management
- **WHEN** the user archives a Project
- **THEN** it leaves the available selector while its files, tasks and artifacts remain intact

