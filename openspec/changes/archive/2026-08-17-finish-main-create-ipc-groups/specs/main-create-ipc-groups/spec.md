## ADDED Requirements

### Requirement: Main modules export create(ctx)

Named main modules SHALL export `create(ctx)` rather than `attach`. The composition root SHALL call `create(ctx)` in order then bind IPC.

#### Scenario: Composition root uses create
- **WHEN** `src/main/index.ts` loads
- **THEN** it constructs `ctx` and calls `create(ctx)` on boot, agent-runtime, icons, shell, knowledge, workbench, and process-guards

### Requirement: IPC registrars receive domain-picked deps

`registerCoreIpc` SHALL accept grouped deps and pass each registrar a bag picked from the domains that channel needs.

#### Scenario: Log IPC does not need the full agent bag in the call site
- **WHEN** a contributor reads `src/ipc/index.ts`
- **THEN** `registerLogsIpc` is invoked with `pick(groups, 'electron', 'paths', 'shell')` rather than an unexplained full dump
