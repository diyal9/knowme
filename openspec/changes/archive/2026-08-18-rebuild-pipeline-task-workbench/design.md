## Context

See `proposal.md` for motivation. Current pipeline UI is three-column *path catalog → cockpit → run list* in `renderDaemonMode` (`src/workbench.js`), with presentation helpers in `src/lib/workbench-daemon-surface.js`. Daemon I/O stays behind main-process IPC (`workbench-daemon-*` via `workbench-daemon-client.js`). Overview already returns `tasks[]`; launch still uses `workbenchDaemonStart` + optional `launchContext`.

## Goals / Non-Goals

**Goals:**

- Task-first shell: left = pipeline task list + new task; right = review/status for the selected task.
- Create dialog matches figure-3 mental model (goal text + supplemental materials).
- Ingest checklist derived from workflow launch-context / catalog required inputs, not only generic PRD/resources chips.
- Keep renderer free of Node `fs`; file pick goes through existing preload/IPC patterns.
- Pure projection helpers stay unit-testable without Electron.

**Non-Goals:**

- Changing Daemon HTTP paths or inventing new server APIs.
- Full real-time log streaming productization (may reuse existing task projection if present).
- Merging top-level 「任务」Tab with pipeline tasks.

## Decisions

### 1. Two primary columns, optional split of the review side

**Decision:** Default layout is **left task rail (~32%) + right review pane (~68%)**. Inside the review pane, use tabs: **状态** (default) / **步骤** / **产物** / **事件**。可选在「状态」内展示进度摘要，避免强制图2完整三栏占用空间。

**Alternatives:** Strict 3-column (任务 | Agent过程 | 审阅) — higher density risk on laptop; defer process column until log stream is ready.

### 2. Path selection moves into create dialog (not left rail)

**Decision:** Workflow/path is a control inside 「创建管线任务」dialog (default = first primary curated path). Left rail no longer lists paths.

**Alternatives:** Keep path list as tertiary drawer — rejected for confusion with “main job is tasks”.

### 3. Ingest requirements pipeline

**Decision:** Extend `workbench-daemon-surface.js` with:

1. `resolveIngestRequirements(workflow, launchContext)` — merge:
   - Explicit `required_inputs` / `requiredInputs` / `catalog.requiredInputs` if present
   - Fallback mapping from known path ids (e.g. doc-to-impl → prd soft; art-heavy → resources)
   - Always include hard: connection + path not locked
2. `evaluateIngest(formState, requirements)` — ready/pending/blocked + `canSubmit`
3. Form acceptance: **≥20 字 intent OR ≥1 supplemental file** (figure-3 rule)

**Renderer:** When dialog opens for a path, best-effort `workbenchDaemonLaunchContext`; on `unsupported`/offline, still show fallback requirements so UX works.

**IPC boundary:** Launch-context remains main-process HTTP; copy/path selection for local files uses existing file dialog IPC if present, else path text fields + drag drop via preload-safe APIs. Do not write large binaries in localStorage—only paths/refs in `daemon-context`.

### 4. Task list source of truth

**Decision:** List is `data.daemon.tasks` from overview; on select, `workbenchDaemonTask(slug)` enriches right pane; artifacts tab uses `workbenchDaemonArtifacts`.

**Search/filter:** Client-side over intent/slug/workflow/status; filters map to existing `daemonRunBucket` buckets.

### 5. Naming

**Decision:** UI strings in 管线服务 use **管线任务**；never label items as top-level 「任务」without 管线 qualifier when confusion is possible. Dialog title: 「创建管线任务」.

### 6. Performance

**Decision:** Render list from already-polled overview (≤20 tasks today). Task detail fetch debounced on selection; no polling loop while tab hidden. Helpers stay pure JS (no DOM).

## Risks / Trade-offs

- **[Risk] Daemon does not declare `required_inputs`** → Fallback catalog + soft defaults; never false-hard-block on missing schema fields.
- **[Risk] Users look for “常用路径” first** → Empty-state copy: 「+ 新建任务」+ 默认路径说明；advanced paths only in dialog select.
- **[Risk] Naming collision with 顶栏任务** → Copy audit in QA; screenshots in evidence.
- **[Risk] Create dialog + start is slower than one-click 开工** → Default path + soft intent still 1–2 fields; keep soft ingest optional by requirement hardness.
- **[Trade-off] No full middle log column in v1** → Review tabs prioritise status/artifacts; expand later.

## Migration Plan

1. Ship UI behind same Tab id `daemon` / 文案「管线服务」— no settings migration.
2. LocalStorage keys for daemon context retained (`knowme.workbench.daemon-context.v1.*`).
3. Rollback: restore previous `renderDaemonMode` path shell from git; pure lib helpers additive.

## Open Questions

- Whether Daemon will soon emit structured `required_inputs` in launch-context (client already tolerant either way).
- Whether create should default to last-used workflow id (product can decide in apply without spec change if default remains “first primary”).
