## ADDED Requirements

### Requirement: Home quick cards do not compete with Composer

On the Agent launch empty state, the recommendation grid under「开始使用」MUST read as secondary shortcuts. Resting styles MUST prefer transparent or near-transparent backgrounds, subdued borders, and muted typography relative to the Composer above them.

#### Scenario: Light visual weight on home grid

- **WHEN** an empty Agent Session renders the pack or office home recommendation grid
- **THEN** each recommendation control uses a light resting treatment (no drop shadow; no solid white card fill)
- **AND** icon marks are smaller or unfilled relative to prior solid tile treatment
- **AND** activating a card still runs the existing shortcut / pack scene execution path
