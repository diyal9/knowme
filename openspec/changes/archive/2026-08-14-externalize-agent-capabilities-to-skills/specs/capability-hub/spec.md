## ADDED Requirements

### Requirement: Hub reports standard Skill compatibility and task extensions

Capability Hub MUST identify whether an imported skill is standard Cursor/Claude Code compatible and MUST separately report optional KnowMe experience declarations, required host tools, connector dependencies and validation warnings.

#### Scenario: Import portable standard Skill

- **WHEN** a local folder contains a valid portable `SKILL.md` package without KnowMe extensions
- **THEN** Hub allows installation and labels it as a standard compatible Skill
- **AND** it does not claim to provide task cards or host tools that were not declared

#### Scenario: Import extended Skill

- **WHEN** a valid Skill also contains KnowMe task declarations
- **THEN** Hub preview shows the contributed task titles, surfaces and required tools
- **AND** installation status reflects both standard Skill validity and extension validity

#### Scenario: Extended metadata is invalid

- **WHEN** optional task metadata fails validation but the standard Skill is valid
- **THEN** Hub presents the exact extension warning
- **AND** the user can distinguish “Skill available without task entries” from complete installation failure

### Requirement: Hub exposes pack-owned Skill provenance

Skills installed through a Capability Pack MUST appear in the unified catalog with pack ownership, source reference, content hash and lifecycle status. Hub MUST prevent independent destructive actions that would leave an enabled owning pack inconsistent.

#### Scenario: View pack-owned Skill

- **WHEN** the user opens a Skill installed by a pack
- **THEN** details identify the owning pack and true source
- **AND** dependencies, permissions and required tools are not shown as empty placeholders

#### Scenario: Attempt to uninstall required pack-owned Skill

- **WHEN** the owning pack remains enabled and the user attempts to uninstall one of its required skills
- **THEN** Hub blocks the action or routes it through pack disable/uninstall
- **AND** no broken scene remains visible
