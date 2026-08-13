## MODIFIED Requirements

### Requirement: Knowledge home establishes one visual workspace
The knowledge home MUST present search, the user's real material index, and supporting status as one coherent workspace rather than unrelated card groups.

#### Scenario: Populated knowledge home
- **WHEN** the user opens “我的知识” with indexed material
- **THEN** the search entry is visible near the top
- **AND** the real material index occupies the primary content area
- **AND** recent updates and health are secondary information
- **AND** the page does not render a large promotional hero or duplicate root title

### Requirement: Knowledge home keeps actions compact
The knowledge home MUST keep material, health, browse, review, and Obsidian actions available without making explanatory copy the visual focus.

#### Scenario: User chooses a secondary action
- **WHEN** the user activates 添加资料、检查问题、浏览全部、待评估 or Obsidian
- **THEN** the existing action and IPC behavior is preserved
- **AND** the action remains keyboard reachable and has an accessible name

### Requirement: Knowledge home remains usable at narrow widths
The knowledge home MUST reflow without horizontal overflow.

#### Scenario: Narrow knowledge window
- **WHEN** the available content width is narrow
- **THEN** the search and action controls reflow
- **AND** the material index and supporting information stack vertically
- **AND** no essential action is clipped
