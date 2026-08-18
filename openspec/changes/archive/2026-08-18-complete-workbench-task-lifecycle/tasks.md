## 1. OpenSpec and state model

- [x] 1.1 Add the versioned Workbench task draft store and restricted main/preload IPC.
- [x] 1.2 Add pure task lifecycle classification and shared state-action helpers with unit coverage.
- [x] 1.3 Load, save and clear the draft without exposing secrets or arbitrary filesystem access.

## 2. Goal-driven preparation

- [x] 2.1 Preserve submitted goals through workflow selection, modal cancellation and team/capability navigation.
- [x] 2.2 Extend the preparation modal with goal, workflow, Agent/context summary and explicit start action.
- [x] 2.3 Make empty and unmatched homepage states actionable and repair the missing image shortcut icon.

## 3. Daemon task lifecycle

- [x] 3.1 Normalize successful, failed, cancelled, waiting and active terminal states in the runner.
- [x] 3.2 Add safe handling for launch, polling, gate, clarification and artifact errors.
- [x] 3.3 Refresh overview/recent tasks after launch, terminal transitions and task reopen.
- [x] 3.4 Add truthful retry/restart, detail, next-step and artifact actions without inventing cancel/resume support.
- [x] 3.5 Normalize and retain recognizable artifacts from Agent Graph, local-team and Daemon terminal results without promoting task inputs or logs.

## 4. Completed result experience

- [x] 4.1 Replace completed collaboration empty-state internals with a user-facing result summary.
- [x] 4.2 Render completed-with-artifacts and completed-empty states distinctly, with truthful open/log/re-run actions.
- [x] 4.3 Add regression coverage for completed UI guidance and cross-backend artifact projection.

## 5. Verification

- [x] 5.1 Add lifecycle and draft unit tests; extend daemon client and workbench static regressions.
- [x] 5.2 Add a loopback Daemon Electron smoke covering launch order, waiting states, terminal states, artifacts and reload.
- [x] 5.3 Run npm test, lint, OpenSpec validation and harness gate; write developer evidence.
