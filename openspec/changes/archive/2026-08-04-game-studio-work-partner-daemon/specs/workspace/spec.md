# Spec Delta: workspace — 游戏工作室任务入口

## ADDED Requirements

### Requirement: Game studio empty state

When settings industry is `game`, the agent empty state MUST show four task scenarios (策划需求、研发实现、测试验收、制作推进) instead of generic office shortcuts.

#### Scenario: Game industry home

- **WHEN** user opens agent surface with industry game
- **THEN** empty state displays KnowMe 工作伙伴 and four scenario buttons
- **AND** left side rail buttons remain visible and unchanged
