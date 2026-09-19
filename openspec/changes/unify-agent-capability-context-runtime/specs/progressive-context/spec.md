## ADDED Requirements

### Requirement: Discoverable catalog and bounded per-turn context

#### Scenario: Large catalog
- **WHEN** the authorized catalog contains more tools than the model window
- **THEN** the runtime MUST preserve discovery access to the catalog and expose only a relevant bounded schema selection

#### Scenario: Skill activation
- **WHEN** a Skill is activated
- **THEN** the runtime MUST preserve its required instructions, dependencies and effective completion contract within the active permission scope

#### Scenario: Shared request budget
- **WHEN** a model request is prepared
- **THEN** messages and tool schemas MUST share the input budget without silently truncating critical controls or current user input

#### Scenario: Explicit scope
- **WHEN** task authorization adds a previously unbound capability
- **THEN** it MUST NOT override disabled capabilities, parent limits, explicit denial or no-tools execution policy
