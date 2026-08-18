# Spec: strict-score-evidence

助理首屏与长列表必须能对照基线复测；壳层不得内联表面 loader。

## Requirements

### Requirement: First-paint CSS is smaller than the HTML god-file baseline

The assistant-route static CSS SHALL be smaller than `f6ad048` `workspace.html` + `workspace-agent.js`, measured by `scripts/strict-perf-bench.js`.

#### Scenario: Repeatable byte bench

- **WHEN** `node scripts/strict-perf-bench.js --json` runs
- **THEN** `ok` is true and `after_first_paint_css_bytes` is less than `before_bytes`

### Requirement: Long threads use a virtual list

Threads of 100 assistant messages SHALL render via Virtuoso, not a static DOM list of all rows.

#### Scenario: 100 messages

- **WHEN** `AssistantMessageVirtuoso` receives 100 messages
- **THEN** the document contains `agent-message-virtuoso` and not `agent-message-static-list`

### Requirement: AppShell only routes

`AppShell.tsx` SHALL import surfaces from `surface-registry` and SHALL NOT call `lazySurface(` or `ensureSurfaceCss`.

#### Scenario: Shell source contract

- **WHEN** the surface CSS contract spec reads `AppShell.tsx`
- **THEN** it matches `from './surface-registry'` and does not match `lazySurface(`
