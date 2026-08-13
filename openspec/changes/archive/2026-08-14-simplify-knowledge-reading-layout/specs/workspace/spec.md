## MODIFIED Requirements

### Requirement: Knowledge home reads as a two-pane document workspace
「我的知识」MUST render exactly two panes: a material tree on the left and a reading/editing surface on the right. The reading surface MUST take all remaining horizontal space and MUST NOT be flanked by a separate context sidebar.

#### Scenario: Populated knowledge home
- **WHEN** the user opens 「我的知识」 with indexed material
- **THEN** the left pane shows the material tree with search and filters
- **AND** the right pane shows the reader or raw editor
- **AND** no third context pane is rendered

#### Scenario: Opening an organized entry
- **WHEN** the user selects a read-only entry from the tree
- **THEN** the reader shows title, path, type, size and updated time once in the document header
- **AND** the same metadata is not duplicated elsewhere on the page

### Requirement: Entry actions live in the reading surface
Entry-level actions (交给 AI 整理、查看提案、检查问题) MUST be reachable from the document header of the reading surface.

#### Scenario: Acting on the open entry
- **WHEN** an entry is open in the reader or raw editor
- **THEN** the document header exposes the entry actions
- **AND** activating an action keeps its existing navigation and IPC behavior
- **AND** each action is keyboard reachable with an accessible name

### Requirement: Knowledge topbar does not print the storage path as body copy
The knowledge topbar MUST NOT render the absolute knowledge root path as a full line of body copy. The path MAY be exposed as a hover title.

#### Scenario: Local knowledge topbar
- **WHEN** the local knowledge surface is shown
- **THEN** the topbar subtitle is a short human sentence
- **AND** the absolute root path is available through the element title only

### Requirement: Two-pane knowledge home reflows at narrow widths
The knowledge home MUST stack the tree above the reading surface at narrow widths without horizontal overflow.

#### Scenario: Narrow knowledge window
- **WHEN** the available content width is narrow
- **THEN** the tree and the reading surface stack vertically
- **AND** the document scroll width does not exceed the viewport width
