## ADDED Requirements

### Requirement: Studio navigation lives in workbench head

When the workbench shows the Studio (编排) surface, the primary workbench header SHALL present the page title「编排工作流」on the left side of `wb-head`, and SHALL present the leave/back control on the right side of `wb-head` (shared `#wbReload` icon button, same pattern as task room). It SHALL NOT require a second full-width studio topbar solely for that navigation, and SHALL NOT duplicate a text「返回」control on the left.

#### Scenario: Enter studio from shelf

- **WHEN** the user opens workflow Studio from the workflow shelf
- **THEN** the workbench head shows the title「编排工作流」on the left
- **AND** the workbench head shows a chevron back control on the right
- **AND** the mode tabs for 任务/工作流/管线服务 are hidden

#### Scenario: Leave studio

- **WHEN** the user activates the Studio back control on the right of `wb-head`
- **THEN** the product returns to the prior shelf/manage surface as today
- **AND** the Studio head navigation is hidden
- **AND** workbench mode tabs return as appropriate for the resulting surface

### Requirement: Studio workspace components unchanged

Studio SHALL keep the existing component palette, expert list, canvas graph, node inspector, and canvas toolbar actions (mode toggle, save, test run). Lifting navigation into the head MUST NOT remove or replace these capabilities.

#### Scenario: Canvas tooling still available

- **WHEN** Studio is active
- **THEN** the user can still add nodes from the library, edit on the canvas, open inspector fields, and use save / test-run actions from the canvas toolbar
