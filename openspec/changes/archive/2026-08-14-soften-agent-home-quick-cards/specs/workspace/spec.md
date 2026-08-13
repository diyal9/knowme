## MODIFIED Requirements

### Requirement: Game studio empty state

When the `game-studio` capability pack is active, the Agent empty state MUST present at most four Feishu-first recommended tasks in a stable 2×2 grid. Requirement intake (`workflow-intake`) MUST NOT appear as an empty-state card or as a separate “启动工作流” entry. Additional pack Skills MUST remain discoverable through the quick command launcher or workbench instead of being appended to the recommendation grid.

#### Scenario: Game studio home recommendations

- **WHEN** user opens an empty Agent surface with the `game-studio` capability pack active
- **THEN** empty state displays “KnowMe 工作伙伴” and at most four recommended task cards
- **AND** recommendations include document/knowledge search, meeting summary, related chats, and today priority when available
- **AND** left side rail buttons remain visible and unchanged

#### Scenario: Game studio workflow intake hidden from empty state

- **WHEN** user views the game studio empty state
- **THEN** the surface MUST NOT show a “启动工作流” entry
- **AND** MUST NOT show “需求梳理” as an empty-state recommendation card

#### Scenario: Extra game studio skills remain discoverable

- **GIVEN** the pack exposes more than four empty-surface tasks or a hidden intake scene
- **WHEN** user searches the quick command launcher or opens the workbench workflow surface
- **THEN** those tasks or workflows remain reachable outside the empty-state recommendation grid
- **AND** the empty-state recommendation grid remains limited to four cards

## ADDED Requirements

### Requirement: Agent home recommendation cards stay visually secondary

Agent 首页「开始使用」推荐卡 MUST 视觉弱于 Composer，避免实心卡片与输入区抢焦点；卡片 MUST 仍可点击并保留可感知的 hover / focus 状态。

#### Scenario: Softened recommendation cards

- **WHEN** user views an empty Agent home with recommendation cards
- **THEN** cards MUST NOT use heavy fill, drop shadow, or high-contrast icon tiles as the default resting state
- **AND** title and description contrast MUST be lower than the Composer placeholder / draft text
- **AND** hover or focus-visible MUST still distinguish the control as interactive
