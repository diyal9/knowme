# main-named-modules Specification

## Purpose
TBD - created by archiving change extract-main-named-modules. Update Purpose after archive.
## Requirements
### Requirement: Main process modules are named by responsibility

The Electron main composition root SHALL load named TypeScript modules (`boot`, `agent-runtime`, `shell`, `knowledge`, `workbench`) rather than numbered `part-*.ts` slices. Each named module SHALL export `attach(scope)` and MUST NOT be concatenated via `vm`.

#### Scenario: No numbered slices remain
- **WHEN** a contributor lists `src/main/*.ts`
- **THEN** there is no file matching `part-*.ts`

#### Scenario: Composition root is explicit
- **WHEN** the app boots via `src/main/index.ts`
- **THEN** it requires `./scope` then calls `attach(scope)` on each named module in documented order, then binds core IPC

### Requirement: Product behavior is unchanged

IPC channel names, window types (workspace / settings / memory / log-viewer), and Agent/knowledge glue SHALL keep existing behavior.

#### Scenario: Core IPC still registered from composition root
- **WHEN** tests read the main entry bundle
- **THEN** `registerCoreIpc` is wired and main files contain no inline `ipcMain.handle`/`on` for domain channels

