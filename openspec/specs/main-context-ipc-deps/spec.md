# main-context-ipc-deps Specification

## Purpose
TBD - created by archiving change extract-main-context-ipc-deps. Update Purpose after archive.
## Requirements
### Requirement: Main process context is owned by the composition root

The main process SHALL create a single context object in `src/main/index.ts` and pass it into named `attach` functions and `bindCoreIpc`. It SHALL NOT export a module-level singleton bag from `scope.ts`.

#### Scenario: No singleton scope module
- **WHEN** a contributor lists `src/main/*.ts`
- **THEN** `scope.ts` is absent and `index.ts` constructs `ctx` before attach

#### Scenario: IPC bind receives the same context
- **WHEN** the app boots
- **THEN** `bindCoreIpc(ctx)` registers handlers via `registerCoreIpc(ctx.ipcMain, createIpcDeps(ctx))`

### Requirement: IPC dependencies are assembled by domain

`src/main/ipc-deps.ts` SHALL export `createIpcDeps` that groups fields by domain in source, while still returning the flat bag `src/ipc` already consumes.

#### Scenario: Domain grouping is visible in source
- **WHEN** a contributor opens `ipc-deps.ts`
- **THEN** they see labeled groups (electron, paths, knowledge, workbench, agent, notes-compat, shell) rather than one uncommented dump

