## 1. Unified workflow and profile data

- [x] 1.1 Add normalized Workflow Package DTO and validation for source, version, lifecycle, inputs, outputs, dependencies, governance and execution backends.
- [x] 1.2 Add local Workflow Package store with list/get/save/fork/archive operations and provenance-preserving snapshots.
- [x] 1.3 Add Agent Profile DTO and store for Skill refs, model policy, connectors, permissions, memory, output contract and budget.
- [x] 1.4 Add Profile and Workflow Package snapshot tests for version drift, disabled capabilities and official-flow immutability.

## 2. Capability and runtime integration

- [x] 2.1 Extend Capability Hub DTOs and IPC with Agent Profile configuration and current-work handoff.
- [x] 2.2 Validate Agent Profile Skill refs, dependencies, risk and permissions through the existing capability governance path.
- [x] 2.3 Adapt existing Daemon workflows and Agent Graph compositions into Workflow Package summaries without changing their execution protocols.
- [x] 2.4 Persist unified Work Context and expose restricted restore/update IPC for goal, workflow, composition, run and artifact refs.

## 3. Workbench product flow

- [x] 3.1 Reshape the workbench home around a goal and route users to professional pipelines, personal workflows or Agent composition.
- [x] 3.2 Add a unified flow library for official, team, personal and forked packages with use, inspect, fork and repair actions.
- [x] 3.3 Add Agent Profile configuration and return-to-goal flow from Capability Hub.
- [x] 3.4 Extend Agent Graph surface with save, fork, profile-aware nodes, Skill summaries and reusable personal workflow actions.
- [x] 3.5 Connect run results to the originating workflow, composition, Agent/Skill snapshots and “save as personal workflow” action.

## 4. Execution and compatibility

- [x] 4.1 Keep execution source explicit across Daemon, Local Team Runtime and legacy local runs while using one Workbench Run projection.
- [x] 4.2 Add validation and fallback behavior for missing capabilities, unsupported backends, stale snapshots and unsafe recovery.
- [x] 4.3 Preserve existing Daemon, capability Hub, legacy local workflow and automation entry points behind the new context model.

## 5. Verification and rollout

- [x] 5.1 Add unit and integration coverage for Workflow Package, Agent Profile, Work Context and fork/version behavior.
- [x] 5.2 Add Electron smoke coverage for goal → flow choice → Agent configuration → Graph save → run projection → result reuse.
- [x] 5.3 Add anti-pattern checks for Daemon misclassification, lost goal context, unauthorized Skill execution and mutable official pipelines.
- [x] 5.4 Run npm test, lint, OpenSpec validation, harness gate and record producer/tester evidence.

## 6. Workbench home product closure (2026-08-08)

- [x] 6.1 Expose three collaboration paths on home (pipeline / agent / graph) with real navigation.
- [x] 6.2 Add dedicated Flow Library tab with official/team/forked/personal grouping, fork and backend labels.
- [x] 6.3 Remove legacy hidden home (`wb-goal-legacy`) and stop rendering into removed DOM.
- [x] 6.4 Add persistent Team assets panel for Agent Profile and personal workflows.
- [x] 6.5 Make `startGoal` show explicit path picker with recommendation instead of implicit Agent Graph routing.

## 7. Production console redesign (2026-08-08)

- [x] 7.1 Replace goal-first IA requirements with a console-first specification covering Overview, Pipelines, Runs, Agents and Studio.
- [x] 7.2 Add a bounded console projection for domain readiness, unified run summaries, attention items and automation state.
- [x] 7.3 Rebuild the workbench shell with visible domain filtering, operational overview and a unified new-run entry.
- [x] 7.4 Replace duplicate flow directories with a pipeline master-detail surface and a run-only history center.
- [x] 7.5 Close Agent continuation, three-domain vertical-slice and automation placeholder gaps without inventing unavailable backends.
- [x] 7.6 Promote Graph composition to a dedicated workspace and reorganize the task room around state, next action, graph, activity and artifacts.
- [x] 7.7 Consolidate workbench visual tokens, responsive layout and complete loading/empty/error/permission states.
- [x] 7.8 Add console-model unit coverage and Electron smoke coverage for office, engineering and visual vertical slices.
- [x] 7.9 Run npm test, lint, OpenSpec strict validation, Electron smoke and harness gate; record developer and QA evidence.

## 8. Workbench closure correction (2026-08-09)

- [x] 8.1 Correct the prior shell-only acceptance and specify the Work / Resources / Studio information architecture with executable closure criteria.
- [x] 8.2 Collapse the five-page shell into three workspaces, remove duplicate launch surfaces and delete the legacy workflow browser from the run directory.
- [x] 8.3 Add one launch controller and persistent launch intent for goal, resource, input, backend, Profile snapshot, Run reference and return state.
- [x] 8.4 Resolve dynamic readiness and real Run creation for domain pipelines, Agent Profiles, Graph compositions, bound automation and artifact reuse.
- [x] 8.5 Consolidate workbench CSS and task-room navigation with complete responsive, focus, loading, empty, blocked and failure states.
- [x] 8.6 Add behavioral unit/integration/Electron coverage, repeat producer and QA acceptance, and pass strict validation plus the Story gate.

## 9. Dual-track workbench simplification (2026-08-09)

- [x] 9.1 Correct the product acceptance record and replace the Work / Resources / Studio IA with Start Work / Build Agent user paths.
- [x] 9.2 Merge workflow discovery and run status into a result-oriented Start Work surface with progressive technical disclosure.
- [x] 9.3 Turn the Studio preview into an editable Agent step flow with drag add/reorder, keyboard alternatives and simple serial/parallel/approval relations.
- [x] 9.4 Replace the Profile ID modal with an inline node inspector for role, Skill selection, prompt, knowledge and collapsed advanced settings.
- [x] 9.5 Extend Agent Profile and Graph snapshots so prompt, knowledge, connector and node Profile references affect real execution and survive reload.
- [x] 9.6 Add unit, responsive Electron and behavior coverage; pass test, lint, strict OpenSpec validation and the Story gate before repeating producer acceptance.

## 10. Four-page responsibility split (2026-08-10)

- [x] 10.1 Define Start Work / Workflow / Agent Management / Daemon Mode responsibilities and the local-vs-Daemon Agent boundary.
- [x] 10.2 Return local and Daemon Agent catalogs separately with stable origin and editability metadata.
- [x] 10.3 Add a dedicated Agent Management page for editing all non-Daemon local Agent Packages and default Profiles.
- [x] 10.4 Rename Build Agent to Workflow, restrict DAG candidates to local Agents and keep node editing step-scoped.
- [x] 10.5 Add a Daemon Mode page for fixed read-only Agent rosters, launch and task monitoring.
- [x] 10.6 Add unit and responsive Electron coverage; pass lint, test, strict OpenSpec validation and Story gate before producer acceptance.
