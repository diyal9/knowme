## ADDED Requirements

### Requirement: Split lib modules stay within the file budget

New TypeScript modules created while splitting grandfathered `src/lib` files SHALL have at most 400 lines. A path MAY be removed from `scripts/architecture-lib-oversize.json` only when that file has at most 400 lines.

#### Scenario: Split sibling is under budget
- **WHEN** a new `src/lib/**/*.ts` file is added as a split of a grandfathered module
- **THEN** it has at most 400 lines and `npm run lint` accepts it without a whitelist entry

#### Scenario: Whitelist entry is dropped only when compliant
- **WHEN** a previously grandfathered path is deleted from `architecture-lib-oversize.json`
- **THEN** that file has at most 400 lines

### Requirement: Public require paths remain stable

Callers SHALL continue to `require` the original `src/lib/<module>` path. Split files are internal; the original module re-exports the same `module.exports` keys.

#### Scenario: Existing require still resolves
- **WHEN** a main-process or test file requires `./capability-catalog` or another split target's original path
- **THEN** the same exported functions or classes remain available
