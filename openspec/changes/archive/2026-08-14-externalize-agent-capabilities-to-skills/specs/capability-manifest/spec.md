## ADDED Requirements

### Requirement: Unified manifests preserve validated namespaced extensions

Capability Manifest MUST preserve optional namespaced host extensions for Skill experience declarations while keeping the normalized common shape and standard package fields unchanged. Unknown or unsafe extension fields MUST be dropped or rejected with field-level diagnostics and MUST NOT become executable host configuration.

#### Scenario: Skill sidecar contains valid KnowMe extension

- **WHEN** a Skill v2 sidecar contains a valid namespaced KnowMe experience declaration
- **THEN** normalization retains the validated declaration in a stable extension field
- **AND** common dependencies, permissions, risk and provenance remain independently available

#### Scenario: Legacy or standard skill lacks extension

- **WHEN** a Skill is adapted from standard frontmatter without host extensions
- **THEN** normalization succeeds with an empty experience extension
- **AND** standard L0–L3 behavior remains unchanged

#### Scenario: Extension attempts to relax host policy

- **WHEN** an extension declares approval bypass, unrestricted filesystem access, raw credential values or an unregistered executable tool
- **THEN** the unsafe field or declaration is rejected with a readable validation error
- **AND** host authorization, approval and sandbox policy remain authoritative

### Requirement: Tool requirements are distinguishable from executable implementations

A Skill declaration MAY name required host tools and connector capabilities, but MUST NOT be treated as registering or implementing those tools. Required tool identifiers MUST be validated as declarative dependencies and resolved against the enabled host Registry at activation time.

#### Scenario: Required host tool is available

- **WHEN** a Skill declares a registered enabled tool and required connector
- **THEN** its normalized manifest exposes those requirements for dependency checks and activation

#### Scenario: Skill text names an arbitrary tool

- **WHEN** a Skill declaration names a tool absent from the host Registry
- **THEN** the Skill MUST NOT gain a new executable tool
- **AND** activation reports the unresolved dependency
