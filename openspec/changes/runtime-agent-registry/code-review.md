# Code Review

## Scope review

- Reused Capability Hub, Expert Runtime, tool approval and task snapshot mechanisms; no second Agent execution engine was introduced.
- Runtime state is isolated below the existing user-data capabilities root. Agent ids are path-safe and revisions are immutable JSON records.
- Existing `expert-save` remains compatible, but complete capability manifests are no longer degraded to legacy fields.
- Lifecycle enforcement is server-side at workbench task, try-chat, snapshot and child-Run entry points.
- The new creation path reuses the workbench task store and expert room; it does not introduce a parallel chat, task or execution runtime.
- The path idempotently installs the curated Capability Governance package before task creation; dependency-install failure leaves the draft recoverable and never opens an unusable room.
- Skill creation is conversational and reuses the same expert task runtime; no parallel Skill form, chat engine or publication authority was introduced.
- Connector management remains installation/configuration only. No connector-authoring contract or UI action was added.

## Security review

- Verify and preview are read-only. Commit is marked `requiresApproval`, accepts only a host-approved opaque token and cannot be authorized with a model-provided boolean.
- Tokens are single-use, expire after 30 minutes and bind to the current canonical definition hash.
- Bundled Agents cannot be overwritten or rolled back; retire is an overlay and does not physically delete their package.
- Tool, Connector and risk declarations are cross-checked before publishing.
- Draft writes are local and reversible and cannot publish an Agent. Publication authority remains exclusively in the approved commit tool.

## Compatibility review

- Legacy Agent packages still load through the legacy adapter.
- Store/catalog normalizers now preserve professional metadata without changing existing defaults.
- Existing historical session snapshots remain the authority for prior tasks.

## Evaluation review

- The implementation follows DeepEval's test-case/metric separation without exposing arbitrary Python execution: suites contain declarative cases and a fixed bridge owns metric construction.
- Deterministic `text_assertions`, `tool_correctness` and `tool_permission` checks run without a model or network. Semantic metrics require a configured judge and an approved runtime invocation.
- Reports retain definition and evaluation configuration hashes. Missing observations, missing DeepEval, unsupported metrics and judge failures are blocking results rather than synthetic scores.
- Runtime installation is isolated under KnowMe user data and is itself an approval-gated tool. No package installation is performed during normal Agent publication.

## Startup regression review

- The main event-loop monitor was defined but not exported, so Electron startup destructuring returned `undefined`. The module now exports the guard explicitly.
- A focused regression test requires the module through the production TypeScript loader, starts the monitor and verifies its stoppable contract.

## Change-impact review

- GitNexus inspected the complete uncommitted worktree: 155 changed symbols across 152 files affect 75 indexed processes and therefore receive a `critical` aggregate risk label.
- The aggregate includes the earlier expert/workflow cleanup as well as this Registry increment. All direct runtime entry points identified for the Registry and evaluation service were covered by focused tests; renderer, lint and both TypeScript gates pass.
- `git diff --check` passed; only existing CRLF normalization notices were emitted.

No unresolved blocking review finding.
