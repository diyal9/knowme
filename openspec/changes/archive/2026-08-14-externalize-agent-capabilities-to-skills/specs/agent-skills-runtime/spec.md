## ADDED Requirements

### Requirement: Skill packages expose optional host experience declarations

Agent Skills Runtime MUST accept Cursor/Claude Code compatible packages containing `SKILL.md` and optional `references/`, `assets/`, and `scripts/`; a package MAY additionally provide namespaced KnowMe task declarations without changing standard `SKILL.md` semantics. Each valid declaration MUST resolve to a normalized task containing stable identity, display metadata, activation prompt, supported surfaces, preconditions, required tools and optional prompt enhancement.

#### Scenario: Standard skill has no KnowMe extension

- **WHEN** a valid Cursor or Claude Code skill contains only `SKILL.md` and standard resource directories
- **THEN** the skill remains discoverable through list, auto-match and slash activation according to its frontmatter
- **AND** absence of a KnowMe task declaration MUST NOT make the skill invalid

#### Scenario: Extended skill declares an office task

- **WHEN** an enabled skill has a valid namespaced task declaration
- **THEN** runtime returns a normalized task DTO linked to that skill
- **AND** the DTO contains only validated display, activation, precondition and tool dependency fields

#### Scenario: Invalid extension is isolated

- **WHEN** a standard skill has malformed optional KnowMe task metadata
- **THEN** runtime reports the extension validation issue and excludes the invalid task
- **AND** the underlying standard skill remains available unless its standard package is itself invalid

### Requirement: Task activation loads skill instructions and preserves host enforcement

Activating a Skill-backed task MUST load the current enabled skill instructions into the Agent context and MUST apply its declared activation prompt and prompt enhancement. Declared tools MUST be resolved only through the host tool Registry, authorization, approval, sandbox and grounding controls.

#### Scenario: Skill-backed task starts

- **WHEN** the user activates a normalized task whose preconditions are satisfied
- **THEN** the corresponding skill body is loaded for that Agent turn
- **AND** its activation prompt and validated enhancement are used without requiring task-specific core constants

#### Scenario: Skill requests unavailable tool

- **WHEN** a task declares a required tool that is missing, disabled or not projected for the run
- **THEN** activation is blocked with the missing tool named
- **AND** runtime MUST NOT fabricate a successful tool result or bypass Registry policy

#### Scenario: Skill package is updated

- **WHEN** an installed or linked skill changes and catalog refresh detects a new content hash
- **THEN** subsequent task discovery and activation use the updated declaration and instructions
- **AND** no KnowMe source-code change is required for that business-level update

### Requirement: Skill task lifecycle follows skill lifecycle

Only enabled and available skills MUST contribute normalized tasks. Disabled, uninstalled, missing-linked or invalid skills MUST NOT contribute entry cards, quick actions or automatic task activation.

#### Scenario: Skill is disabled

- **WHEN** the user disables a skill that contributes tasks
- **THEN** those tasks disappear from subsequent task discovery
- **AND** unrelated enabled skills remain available

#### Scenario: Linked source is missing

- **WHEN** a registered Cursor skill source can no longer be read
- **THEN** its tasks are excluded and its availability reports the missing source honestly
- **AND** runtime MUST NOT use stale task prompts as if the source were current
