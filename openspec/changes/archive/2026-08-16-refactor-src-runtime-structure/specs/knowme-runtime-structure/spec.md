## ADDED Requirements

### Requirement: Thin main boot

The Electron entry `src/main.js` SHALL only register TypeScript loading and delegate to `src/main/index.ts`.

#### Scenario: Boot file size

- **WHEN** measuring `src/main.js`
- **THEN** it contains at most 100 lines and no business logic beyond bootstrap

### Requirement: Main process modules under budget

Each `src/main/*.ts` file SHALL not exceed 400 lines.

#### Scenario: Architecture lint

- **WHEN** running `npm run lint`
- **THEN** no `src/main/*.ts` file fails the line budget check

### Requirement: IPC layer TypeScript

All handlers under `src/ipc/` SHALL be TypeScript files; method names in `src/shared/api.ts` remain stable.

#### Scenario: IPC registration

- **WHEN** the app starts
- **THEN** `registerCoreIpc` loads from `src/ipc/index.ts` without changing channel names

### Requirement: Workbench display rules in domain

Shelf labels, escape helpers, provenance labels, and run-phase mapping SHALL live under `src/domain/` without DOM or Electron imports.

#### Scenario: Unit tests import domain

- **WHEN** tests require shelf provenance or run phase helpers
- **THEN** they import from `src/domain/` not `src/workbench/`
