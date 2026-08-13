## 1. Graph composition and validation

- [x] 1.1 Add a pure Workbench Agent Graph composition module with bounded serial, parallel, gate and terminal graph templates.
- [x] 1.2 Resolve selected Expert/Agent references into versioned Package snapshots and compile explicit Team Package nodes and edges.
- [x] 1.3 Add validation and unit coverage for unknown agents, dangling edges, cycles, handoff gaps, parallelism and governance limits.

## 2. Main-process Team Runtime bridge

- [x] 2.1 Instantiate and configure `AgentTeamWorkflowRunner` beside the existing `AgentRunManager` without changing `AgentRunExecutor`.
- [x] 2.2 Add structured IPC for graph planning, validation, local graph start, Run Tree reads and gate decisions.
- [x] 2.3 Expose the restricted graph/runtime DTO methods through preload and reject arbitrary Package paths or unvalidated execution payloads.
- [x] 2.4 Persist the confirmed composition snapshot, rootRunId, Package hashes and goal for reopen/recovery behavior.

## 3. Workbench experience and projection

- [x] 3.1 Add a goal-driven Agent Graph proposal surface that lists recommended Agents, responsibilities, inputs/outputs and execution relationships.
- [x] 3.2 Add confirmation and revision actions that revalidate the latest graph before starting a local Team Run.
- [x] 3.3 Project Root/child Run states, gate actions, logs, artifacts, evidence and truthful recovery actions into the existing task room.
- [x] 3.4 Keep Daemon workflows and legacy local workflows available with explicit execution-source labels and unchanged protocol semantics.

## 4. Verification and rollout

- [ ] 4.1 Add unit and integration coverage for composition compilation, Team Runner startup, handoff, gate, terminal and failure paths.
- [ ] 4.2 Add Electron smoke coverage for goal → graph proposal → confirmation → multi-Agent Run → gate → result/reload.
- [ ] 4.3 Add feature-flag fallback coverage proving legacy local and Daemon paths remain usable.
- [x] 4.4 Run npm test, lint, OpenSpec validation and harness gate; record developer evidence.
