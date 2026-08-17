## ADDED Requirements

### Requirement: Line count is advisory until a file is too large

`npm run lint` architecture check SHALL warn (not fail) when a `src/**/*.{ts,tsx}` file exceeds 1200 lines and is at most 2000 lines. It SHALL fail when a file exceeds 2000 lines unless that path is a shrinking-only entry in `scripts/architecture-lib-oversize.json`.

#### Scenario: Cohesive module between 1200 and 2000
- **WHEN** a TypeScript file under `src/` has more than 1200 and at most 2000 lines and is not listed as exceeding its grandfather cap
- **THEN** architecture check prints a warning and exits 0 if there are no other architecture errors

#### Scenario: File is too large
- **WHEN** a TypeScript file under `src/` has more than 2000 lines and has no grandfather entry, or exceeds its grandfather cap
- **THEN** architecture check fails

### Requirement: Split by change reason not by line quota

Agents and humans SHALL NOT split a module solely to get under 1200 lines. A split SHALL isolate a second reason to change (domain boundary), keep `require` of the original path stable, and MUST NOT introduce a shared god `ctx` or duplicate rule modules.

#### Scenario: Reject line-quota-only split
- **WHEN** a refactor would only move methods or nested functions to sibling files so each file is ≤1200 lines, without a new domain boundary
- **THEN** that split is out of scope for architecture work
