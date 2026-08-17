# hard-gate-test-debt Specification

## Purpose
Define the Story hard-gate test baseline so archive and `/story-done` can trust `npm test` and renderer Vitest without coupling to main-process structure refactors.
## Requirements
### Requirement: Hard gate Node suite is green
The repository SHALL pass the Story 完成硬门禁 Node suite invoked by `npm test` (as configured in `package.json` / harness) with zero failing tests.

#### Scenario: Full Node suite after debt fix
- **WHEN** a developer runs `npm test` on a clean tree after this change
- **THEN** the process exits 0 and reports zero failing tests

### Requirement: Hard gate renderer Vitest is green
The repository SHALL pass `npm run test:renderer` with zero failing tests.

#### Scenario: Renderer Vitest after debt fix
- **WHEN** a developer runs `npm run test:renderer`
- **THEN** the process exits 0 and reports zero failing tests

### Requirement: Gate remains blocking until green
Until the hard-gate suites are green, `/story-done` for unrelated structure changes SHALL remain blocked by harness gate; this change SHALL not weaken that rule without an explicit maker-approved harness contract update documented in the change evidence.

#### Scenario: No silent gate shrink
- **WHEN** someone proposes removing failing suites from the hard gate
- **THEN** the change MUST document maker approval and update harness evidence before archive

