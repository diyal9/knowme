## MODIFIED Requirements

### Requirement: Professional canvas nodes show agentUniverse-style sectioned summaries

The professional workflow studio canvas SHALL render each node as a sectioned card (type-colored header plus one or more summary sections), so authors can scan inputs / configuration / prompt / outputs on the graph without opening the inspector for every glance.

#### Scenario: Start node exposes input summary section

- **WHEN** the free or linear board includes a start node and the draft defines workflow inputs
- **THEN** the start node card SHALL display an "输入" (or equivalent) section listing input labels (or a default placeholder when empty)

#### Scenario: LLM node exposes prompt summary section

- **WHEN** a node of kind `llm` is present with prompt or model configuration
- **THEN** the card SHALL show distinct configuration section(s) covering at least model or prompt preview and an output hint

#### Scenario: Expert / tool / knowledge nodes expose binding and IO summary

- **WHEN** a node of kind `agent`, `tool`, or `knowledge` is rendered on the professional canvas
- **THEN** the card SHALL include at least one section summarizing bound resource (expert / skill / knowledge) or node goal, and at least one IO-oriented section or row

#### Scenario: Condition node surfaces branch semantics

- **WHEN** a node of kind `condition` is rendered
- **THEN** the card SHALL show the comparison summary and indicate dual-branch behavior

#### Scenario: Inspector remains available for deep edits

- **WHEN** the user needs configuration beyond the light in-node fields
- **THEN** full editing SHALL remain available in the right-hand properties inspector; skill multi-select and workflow-level IO structure MAY still prefer the inspector

#### Scenario: Runtime graph unchanged by visual card richness

- **WHEN** a draft is saved or compiled after this visual change
- **THEN** composition node types, edges, and validation rules SHALL behave as before (visual layout size and editable presentation only)

#### Scenario: Professional canvas supports lightweight in-node edits

- **WHEN** the user focuses an editable control on a professional canvas node card (name / intent / prompt / IO label / condition / skill or knowledge bind)
- **THEN** the draft SHALL update without requiring the right-hand inspector, and the node SHALL NOT fully remount on every keystroke in a way that steals input focus

#### Scenario: Inline edit keeps inspector as secondary sync surface

- **WHEN** an inline field is blurred or a select value is committed
- **THEN** the properties inspector for the same selected node SHALL reflect the updated values on the next inspector render

#### Scenario: Inline controls do not conflict with graph gestures

- **WHEN** the user interacts with an inline input, textarea, or select on a node
- **THEN** pointer drag for repositioning and port wiring SHALL not capture that gesture while the control is being used
