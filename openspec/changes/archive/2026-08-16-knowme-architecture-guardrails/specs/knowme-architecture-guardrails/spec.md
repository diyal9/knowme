## ADDED Requirements

### Requirement: Architecture document is the source of truth

The repository SHALL publish runtime layering, feature-package rules, file budget, and the retired notes product in `docs/architecture.md`. `AGENTS.md` SHALL link to that document.

#### Scenario: Agent and humans share one architecture page
- **WHEN** a contributor needs KnowMe runtime structure
- **THEN** they read `docs/architecture.md` rather than reconstructing rules from chat

### Requirement: Lint enforces file budget and retired fixtures

`npm run lint` SHALL fail when a `src/**/*.{ts,tsx}` file exceeds 400 lines (except shrinking-only grandfathered paths in `scripts/architecture-lib-oversize.json`), when `src/lib` contains `.js`, when a new page-level `src/*.html` appears (except `attention-toast.html`), when `tests/fixtures/legacy-pages` exists, or when domain modules use `window`/`document`/Electron.

#### Scenario: Over-budget file is rejected
- **WHEN** a TypeScript file under `src/` has more than 400 lines and is not a shrinking grandfathered `src/lib` file
- **THEN** `npm run lint` exits non-zero

#### Scenario: Application services stay TypeScript
- **WHEN** a `.js` file exists under `src/lib`
- **THEN** `npm run lint` exits non-zero

#### Scenario: Golden pages cannot return
- **WHEN** `tests/fixtures/legacy-pages` is present or a test reads that path
- **THEN** `npm run lint` exits non-zero
