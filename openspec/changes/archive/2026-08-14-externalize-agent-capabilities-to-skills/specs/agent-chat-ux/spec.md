## ADDED Requirements

### Requirement: Agent task surfaces are driven by normalized Skill tasks

Empty-state cards and composer quick actions MUST be rendered from enabled normalized Skill/Pack task declarations. A task declaration MUST be able to control title, subtitle, icon, group, mode and supported surfaces without adding task-specific Renderer constants.

#### Scenario: Installed Skill contributes both surfaces

- **WHEN** an enabled Skill task declares empty-state and quick-menu surfaces for the current mode
- **THEN** the same task identity appears in both surfaces with declared display metadata
- **AND** both activations use the same prompt and preflight path

#### Scenario: Skill display metadata changes

- **WHEN** an installed Skill is updated with a different task title or activation prompt
- **THEN** the refreshed Agent surface and subsequent activation use the new values
- **AND** no KnowMe source-code change is required

#### Scenario: No dynamic task is available

- **WHEN** task discovery is unavailable or returns no valid task for a legacy mode
- **THEN** the existing safe legacy task preset remains usable
- **AND** the UI reports discovery failure only when it prevents all usable entries

### Requirement: Skill task preflight is deterministic and declarative

Task preflight MUST evaluate validated declarative preconditions before invoking the model. Supported host preconditions MUST include connector authorization and required user material; failures MUST use the declared fixed guidance, defer the task when applicable and MUST NOT call the LLM.

#### Scenario: Connector authorization is missing

- **WHEN** a Skill task requires an authorized connector and authorization is not ready
- **THEN** the declared fixed authorization guidance is shown
- **AND** no model or business tool is invoked

#### Scenario: Required material is missing

- **WHEN** a Skill task requires user material and no text or attachment is available
- **THEN** the declared fixed material request is shown and the task is deferred
- **AND** sending the missing material resumes with the same Skill task identity

#### Scenario: Preconditions pass

- **WHEN** all declared preconditions and required tools are available
- **THEN** activation loads the Skill and begins the task without an unnecessary clarification

### Requirement: Prompt enhancement is generic and bounded

The Agent UI MAY apply a Skill-declared prompt enhancement template using host-provided bounded variables such as current date or selected mode. It MUST NOT execute arbitrary template code, access secrets or bypass Agent context and grounding controls.

#### Scenario: Task needs current natural date

- **WHEN** a task enhancement uses an allowed current-date variable
- **THEN** activation resolves the variable at click time and includes the resulting date range

#### Scenario: Task template requests unsafe variable

- **WHEN** an enhancement references an unknown, secret or executable expression
- **THEN** validation rejects or omits that expression
- **AND** activation remains within the declared safe prompt behavior
