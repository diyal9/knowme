## ADDED Requirements

### Requirement: Assistant can apply reply text to the active source file

After an assistant reply finishes streaming, KnowMe MUST offer apply actions when a content-source file target is available. Insert and append MUST write through the sources file APIs. Full replace MUST create an `editor_patch` draft artifact for explicit accept/reject.

#### Scenario: Insert appends at cursor semantics via file rewrite

- **WHEN** the user chooses insert or append with an apply target set
- **THEN** the file is updated via sources read/write and a toast confirms the action

#### Scenario: Replace requires artifact confirmation

- **WHEN** the user chooses replace
- **THEN** an editor_patch draft appears in the session artifact list until accepted or rejected

### Requirement: Session artifacts render in the assistant column

Draft and resolved run artifacts for the active assistant session MUST be visible as cards with open/accept/reject actions matching existing agent-artifact chrome.

#### Scenario: Accept editor patch writes file

- **WHEN** the user accepts an editor_patch artifact
- **THEN** KnowMe applies the patch body to the target file path and marks the artifact accepted
