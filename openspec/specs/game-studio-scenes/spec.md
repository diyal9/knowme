# game-studio-scenes Specification

## Purpose
TBD - created by archiving change game-studio-work-partner-daemon. Update Purpose after archive.
## Requirements
### Requirement: Game industry scene routing

When user industry is `game`, the system MUST resolve task scenes (`game-design`, `game-dev`, `game-qa`, `game-production`) instead of generic office scenes.

#### Scenario: Legacy writing maps to design

- **WHEN** industry is game and agentId/mode is writing
- **THEN** resolved scene is `game-design`

### Requirement: Legacy agentId compatibility

Legacy agentId values MUST remain valid for Session storage; display names MAY show game scene labels.

#### Scenario: Session restore

- **WHEN** an old Session with agentId `coding` is opened under game industry
- **THEN** chat routing uses `game-dev` without migration errors

