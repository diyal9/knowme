# Acceptance

## Result

Accepted for the v0.5.0 source baseline.

- Runtime creation writes only `%APPDATA%\\KnowMe\\capabilities\\experts` and `agent-registry`; adding a later business Agent does not require a source/catalog edit.
- Professional definitions are blocked unless scope, method Skill, boundaries, IO, routes, deliverables, quality review, permissions and risk are coherent.
- Create/update/retire/restore/rollback use preview-confirm-commit with expiring, single-use, hash-bound tokens.
- Retire blocks new expert tasks, try-chat, snapshot creation and child Runs while preserving the package, immutable revisions and existing task snapshots.
- The partner and the `能力管家` can reuse the governed draft, verification, preview, commit and revision tools through the `agent-registry-operations` Skill.
- The same expert can list, read and statically verify installed Skills, then publish only user-owned Skill definitions after explicit confirmation and host approval.
- The capability hub saves Agent structure as a draft and opens the existing expert collaboration room for tuning, testing and evaluation.
- “我的技能” uses conversational co-creation instead of a direct definition form; “我的连接器” lists installed connectors without exposing a connector-creation action.
- `能力管家` is the concise user-facing name for stable expert id `agent-operations`; existing tasks and bindings remain compatible.
- The capability manager has no Agent selector in the top status bar. Existing Agents are selected conversationally or with `#` inside the composer, where the selected Agent is shown as a removable token and submitted as the exact management target.
- Structural readiness is labelled `definition-only`; it does not claim real-scenario professional qualification.
- `能力管家` can save versioned evaluation suites, run deterministic output/tool/permission checks locally, invoke approved DeepEval semantic judges through a fixed bridge, and read immutable reports bound to the Agent definition hash.
- Semantic evaluation fails closed when DeepEval, judge configuration or real observations are unavailable. DeepEval can be installed only into the isolated KnowMe runtime after host approval; no KnowMe source or system Python environment is changed.
- A passing scenario-regression report is evidence for the evaluated configuration, not an independent professional certification.

## Release

Package/runtime version is `0.5.0`. This acceptance covers the runtime Agent Registry and evaluation increment, not every broader item in the v0.5.0 product plan.
