# Test Report

Date: 2026-09-23

## Focused verification

`node -r ./scripts/register-ts.js --test tests/agent-evaluation.test.js tests/agent-registry-tools.test.js tests/runtime-agent-registry.test.js tests/professional-agent-definition.test.js tests/capability-integration.test.js tests/expert-commission-lifecycle.test.js tests/expert-runtime.test.js`

- Professional definition validation and schema-v3 manifest persistence
- Preview-only behavior, single-use/expired/stale token rejection
- Create, retire, restore and rollback with immutable revisions
- Host approval contract and Skill-to-tool projection
- IPC/preload wiring and server-side retired-Agent gate
- Legacy Expert Runtime compatibility
- Structured draft persistence and published-state linkage
- Capability Hub save-to-draft → create Capability Governance task → open existing expert room
- Skill governance list/read/verify/publish contracts, read-only package protection and host approval
- Capability Hub search, “我的技能”, “我的连接器”, Skill conversational creation and connector no-create behavior
- Six-expert catalog/governance/install closure and `agent-operations` qualification matrix
- DeepEval-style suite validation, deterministic metrics, semantic bridge failure/score handling and isolated runtime setup seam
- Electron startup event-loop monitor export and stoppable-guard regression

Result: pass.

## Full gate

`npm run check`

- Node tests: 3670 tests, 3619 pass, 51 skip, 0 fail
- Runtime Agent evaluation suite: 5/5 pass
- Renderer tests: 95 files, 746 tests, 0 fail
- Lint/architecture/color/cascade/script-scope: pass; existing advisory file-size and prompt warnings only
- Renderer TypeScript and library TypeScript: pass
- Fixed Python DeepEval bridge syntax compilation: pass

Result: pass. The expert qualification matrix was generated before the final gate so catalog governance evidence and tests used the same current portfolio.

## Electron UAT

Ran the development Electron shell with an isolated temporary user-data directory and inspected it over the local Chromium debugging protocol.

- “能力管家” is visible in the expert catalog while stable id `agent-operations` remains unchanged.
- Skill and connector tabs both expose the search icon and their corresponding personal-management button.
- Skill search filters the rendered catalog.
- “我的技能” includes “新建技能”; selecting it opens the ability-governance collaboration room and no “创建技能” form appears.
- “我的连接器” has no “新建连接器” action and the retired “只看已安装” switch is absent.
- Browser console errors: 0.

Result: 9/9 UAT checks passed.

## Flake follow-up

The earlier `applies late v2 answer.committed after invoke returns` renderer case passed five focused consecutive runs and also passed in the final full renderer suite. No unrelated runtime code was changed without a reproducible failure.

## Capability Governance qualification readiness

`npm run eval:experts:matrix`

- Retained experts: 6/6 ready for live execution
- `agent-operations`: 6 frozen cases covering normal×2, edge, retry, revision and reopen
- This matrix proves coverage readiness only; it does not claim independent live professional qualification.
