## ADDED Requirements

### Requirement: Capability packs can bundle standard Skill packages

A Capability Pack MAY include standard Skill directories under a declared pack-relative root. Pack discovery and installation MUST validate each `SKILL.md`, optional sidecar and resource path, register the skills as atomic capabilities, and bind scenes to the registered skill identities without requiring KnowMe core source changes.

#### Scenario: Install pack with bundled skills

- **WHEN** a trusted local pack declares a pack-relative skills root containing valid standard Skill packages
- **THEN** installation registers those skills and enables valid scene references in one operation
- **AND** the installed skills retain standard `SKILL.md`, resource and script behavior

#### Scenario: Bundled skill path escapes pack

- **WHEN** a declared skills root, sidecar resource or linked path resolves outside the pack root
- **THEN** pack installation is rejected before any capability becomes enabled

#### Scenario: Bundled skill identity conflicts

- **WHEN** a bundled skill ID conflicts with an installed capability from a different source
- **THEN** installation reports the conflict and MUST NOT silently replace the existing capability

### Requirement: Pack and bundled Skill lifecycle is transactional

Pack installation, update, disable and uninstall MUST keep bundled Skill registration and scene availability consistent. A failed bundled Skill operation MUST NOT leave a partially enabled pack.

#### Scenario: Bundled skill validation fails during install

- **WHEN** any required bundled skill is invalid
- **THEN** the pack remains uninstalled or disabled
- **AND** no partial scene or task entry is exposed

#### Scenario: Pack is disabled

- **WHEN** the user disables an installed pack
- **THEN** pack-owned scenes and bundled Skill tasks stop participating in discovery
- **AND** independently installed skills with different ownership remain unchanged

#### Scenario: Pack update changes task metadata

- **WHEN** a pack update contains a new bundled Skill content hash
- **THEN** runtime atomically replaces the pack-owned skill registration and task declarations
- **AND** subsequent discovery uses the updated business behavior

### Requirement: Legacy scene-only packs remain compatible

Packs that only contain legacy scenes and Skill references MUST continue to load. Runtime MUST adapt their scene prompts to normalized task entries when possible and MUST use existing legacy rendering when no valid Skill task is available.

#### Scenario: Existing game-studio pack is loaded before migration

- **WHEN** an installed pack has scene metadata but no bundled skills root
- **THEN** its visible scenes remain discoverable with their existing labels and prompts
- **AND** routing and legacy mode mappings remain functional
