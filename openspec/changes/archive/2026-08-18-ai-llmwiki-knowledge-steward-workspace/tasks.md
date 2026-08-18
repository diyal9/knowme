## 1. Knowledge task contracts

- [x] 1.1 Add a knowledge-steward task state model for scope, progress, cancellation, retry, resume, and terminal status.
- [x] 1.2 Add proposal metadata for source path, source hash, target category, rationale, diff summary, confidence, and review status.
- [x] 1.3 Add unit tests for task transitions, duplicate retry protection, source-change conflicts, and reject-without-write behavior.

## 2. Knowledge OS safety and batch operations

- [x] 2.1 Restrict ingest input files to the bound Wiki root or explicitly authorized Source roots.
- [x] 2.2 Add batch proposal generation for selected Wiki entries without implicitly selecting the first entry.
- [x] 2.3 Add source hash validation, atomic proposal acceptance, index refresh, and post-write lint.
- [x] 2.4 Return actionable lint issue metadata that supports opening the source entry and creating a scoped repair proposal.
- [x] 2.5 Add focused tests for path escape, batch promote, source conflict, atomic acceptance, and index refresh.

## 3. Main-process IPC and Agent integration

- [x] 3.1 Expose task create, status, cancel, retry, resume, proposal list, accept, and reject operations through preload IPC.
- [x] 3.2 Connect the steward role templates to the shared task and proposal services.
- [x] 3.3 Add knowledge-specific organization and review tool contracts with explicit read/propose/write permissions.
- [x] 3.4 Ensure accepted proposals invalidate knowledge caches and are visible to subsequent Agent retrieval.
- [x] 3.5 Add IPC and Agent integration tests for unavailable services, cancellation, retry, and review outcomes.

## 4. Knowledge workspace interaction

- [x] 4.1 Replace the fixed browse-first landing view with a state-driven AI organization dashboard.
- [x] 4.2 Add scope selection for all, changed/new, topic, and selected-entry organization.
- [x] 4.3 Add in-page task progress with cancel, retry, resume, and failure details.
- [x] 4.4 Add a proposal review view with list, source preview, diff summary, confidence, and accept/edit/reject/later actions.
- [x] 4.5 Make health issues clickable and route each issue to its source entry or scoped AI proposal.
- [x] 4.6 Keep material browsing, source management, remote RAG, and Obsidian as secondary navigation.
- [x] 4.7 Remove hardcoded development-machine paths and align all steward copy with the new workflow.

## 5. Verification and handoff

- [x] 5.1 Add regression tests for dashboard states, proposal review actions, narrow-window behavior, keyboard focus, loading, empty, and error states.
- [x] 5.2 Run `npm test`, `npm run lint`, OpenSpec validation, and targeted Electron smoke coverage for the knowledge workspace.
- [x] 5.3 Record developer self-test, producer acceptance checklist, and tester QA evidence under the change evidence directory.
