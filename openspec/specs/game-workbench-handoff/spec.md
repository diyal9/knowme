# game-workbench-handoff Specification

## Purpose
TBD - created by archiving change game-studio-work-partner-daemon. Update Purpose after archive.
## Requirements
### Requirement: Honest daemon readiness

Handoff MUST NOT proceed when daemon overview reports offline or auth_required; MUST return recovery steps.

#### Scenario: Offline daemon

- **WHEN** daemon online is false
- **THEN** handoff ok=false, blocked=true, recovery array non-empty

### Requirement: Real workflow selection

When daemon is online, handoff MUST pick workflow from daemon overview list, preferring team-run or scene default.

#### Scenario: Successful handoff payload

- **WHEN** requirement is approved and daemon has workflows
- **THEN** handoff includes workflow id, slug, intent, context, and trace (sceneId, skillId)

