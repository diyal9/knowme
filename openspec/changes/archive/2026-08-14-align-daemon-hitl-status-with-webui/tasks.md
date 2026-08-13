## 1. Shared runtime status

- [x] 1.1 Add `hasPendingHitl` + `resolveDaemonRuntimeState` in lifecycle (or client) and unit tests
- [x] 1.2 Wire `taskState` / `task()` to prefer status + HITL; fix return spread so computed state/terminal win

## 2. UI projection alignment

- [x] 2.1 Fix `buildWorkbenchTaskBrief` so gate/clarification wins over succeeded
- [x] 2.2 Fix `runOutcomePresentation` waiting-before-done; fix progress card waitingKind/`terminalDone`
- [x] 2.3 Update `daemonRunBucket` / `classifyTaskState` for pending_* and idle+HITL → needs_you/waiting
- [x] 2.4 Ensure `refreshDaemonTask` does not mark terminal success while HITL pending

## 3. Verification

- [x] 3.1 Extend brief / client / lifecycle / surface tests for HITL-over-done
- [x] 3.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md`
