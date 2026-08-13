## MODIFIED Requirements

### Requirement: Studio navigation lives in workbench head

When the workbench shows the Studio (编排) surface, the primary workbench header SHALL present the current workflow name as the primary title on the left side of `wb-head`, and that title SHALL be editable in place (click to rename). The secondary meta line SHALL start with the scene label「编排工作流」, then node count and save state. The leave/back control SHALL remain on the right side of `wb-head` (shared `#wbReload` icon button). It SHALL NOT require a second full-width studio topbar solely for that navigation, and SHALL NOT duplicate a text「返回」control on the left.

#### Scenario: Enter studio from shelf

- **WHEN** the user opens workflow Studio from the workflow shelf
- **THEN** the workbench head shows the current workflow name as the primary title on the left
- **AND** the secondary meta line begins with「编排工作流」
- **AND** the workbench head shows a chevron back control on the right
- **AND** the mode tabs for 任务/工作流/管线服务 are hidden

#### Scenario: Rename workflow from head title

- **WHEN** the user clicks the Studio primary title and enters a new non-empty name
- **THEN** the draft workflow name updates, the title shows the new name, and the draft is marked unsaved until save

#### Scenario: Leave studio

- **WHEN** the user activates the Studio back control on the right of `wb-head`
- **THEN** the product returns to the prior shelf/manage surface as today
- **AND** the Studio head navigation is hidden
- **AND** workbench mode tabs return as appropriate for the resulting surface
