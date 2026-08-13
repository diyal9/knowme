## ADDED Requirements

### Requirement: Root LLMWiki opens as a visual workbench
The root LLMWiki MUST open as a coherent workbench with a material tree, a document reader/editor, and a current-entry context area.

#### Scenario: Open populated root LLMWiki
- **WHEN** the user opens “我的知识” and the root contains indexed entries
- **THEN** the workbench shows the real directory and entry tree on the left
- **AND** it shows a reader area in the center
- **AND** it shows contextual metadata and actions on the right
- **AND** it does not show a promotional hero or a dashboard-only status layout

### Requirement: Entries preserve read and edit boundaries
The workbench MUST preserve the existing distinction between editable raw material and read-only organized knowledge.

#### Scenario: Select raw material
- **WHEN** the user selects an entry under `raw/`
- **THEN** the center area shows the Markdown/text editor and rendered preview
- **AND** the user can save through the existing safe-save flow
- **AND** unsaved and stale-content states remain visible

#### Scenario: Select organized knowledge
- **WHEN** the user selects an entry under `concepts/`
- **THEN** the center area shows a readable document view
- **AND** the entry is not presented as an editable raw file

### Requirement: Context panel explains the selected entry
The workbench MUST show useful context for the selected entry without requiring internal architecture knowledge.

#### Scenario: Entry context is available
- **WHEN** an entry is selected
- **THEN** the context area shows its source path, content type, update time and edit boundary
- **AND** it offers only actions supported by the current entry and existing services

#### Scenario: No entry is selected
- **WHEN** the workbench opens without a selected entry
- **THEN** the center area shows a compact welcome or recent-entry state
- **AND** the context area shows root-library status and a next action
- **AND** it does not render a large empty statistics dashboard

### Requirement: Existing knowledge operations remain reachable
The workbench MUST preserve search, refresh, health check, review, add-material and Obsidian handoff actions.

#### Scenario: Use a global operation
- **WHEN** the user searches, refreshes, checks, reviews, adds material or opens Obsidian
- **THEN** the existing operation is invoked
- **AND** the action remains keyboard reachable with an accessible name

### Requirement: Narrow windows remain usable
The workbench MUST reflow without horizontal overflow at narrow window widths.

#### Scenario: Narrow knowledge window
- **WHEN** the available width is approximately 510px
- **THEN** the tree, reader and context areas stack in a usable order
- **AND** the selected entry and primary actions remain visible
- **AND** the document editor remains usable
