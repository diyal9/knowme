## ADDED Requirements

### Requirement: Canvas primitives are explicit
New workflows SHALL contain only Agent, Human, Action and control nodes, and edges SHALL support explicit handoff mappings.

#### Scenario: Add an action
- **WHEN** an author adds an Action node
- **THEN** it references a validated Action Contract rather than a guidance-only Skill

### Requirement: Publishing needs evidence
A personal workflow SHALL NOT publish without a complete successful draft Run reference.

#### Scenario: Publish without a run
- **WHEN** no successful Run is supplied
- **THEN** publishing fails and the draft remains editable
