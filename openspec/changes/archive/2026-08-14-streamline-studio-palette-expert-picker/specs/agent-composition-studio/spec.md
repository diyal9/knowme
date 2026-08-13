## MODIFIED Requirements

### Requirement: Studio library is a compact single-column component palette

The Studio left library SHALL show only a component palette (no Configuration tab). Component types SHALL be listed in a single column and MAY be grouped into labeled sections (e.g. flow boundary, capability, control).

#### Scenario: Configuration tab removed

- **WHEN** the user opens 编排工作流 Studio
- **THEN** the left library does not present a 配置 tab or a saved-workflow list pane

#### Scenario: Single-column palette

- **WHEN** the component palette is rendered
- **THEN** node type entries are laid out in one column with optional section headings

### Requirement: Expert nodes are added via multi-select workbench picker

Selecting the Expert component on the palette SHALL open a secondary dialog listing experts currently bound to the workbench. The user SHALL be able to multi-select cards (visible selected checkmark), then confirm to add one Expert node per selected expert onto the canvas.

#### Scenario: Open picker from Expert palette item

- **WHEN** the user clicks the Expert palette item
- **THEN** a dialog opens listing workbench-bound experts with cards matching the expert library / quick-task card chrome

#### Scenario: Multi-select and confirm

- **WHEN** the user selects one or more expert cards and confirms
- **THEN** each selected expert is added as an agent node on the draft graph and the dialog closes

#### Scenario: Empty workbench experts

- **WHEN** no experts are bound to the workbench
- **THEN** the dialog shows an empty state with guidance to add experts from the expert library
