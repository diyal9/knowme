## Context

See `proposal.md` for motivation. The current renderer builds capability-pack empty cards by combining declared scenes with unrepresented dynamic tasks, so the grid can grow beyond its intended size. The Ctrl+K surface renders the same task catalog through a fixed two-column category/subitem menu. Both paths already converge on `runTaskCard`, which preserves connector/material preflight.

The change is renderer-only. Skill discovery and capability-pack loading already cross the Electron IPC boundary before this UI is rendered; no new main-process API or persisted data is required.

## Goals / Non-Goals

**Goals:**

- Keep the home recommendation area structurally stable while preserving discoverability of every task.
- Separate one-shot recommended tasks from workflow intake.
- Turn Ctrl/Cmd+K into a fast, searchable command launcher without changing task execution semantics.
- Keep the implementation dependency-free and cheap to render.

**Non-Goals:**

- No main-process, preload, IPC, Skill manifest, permission, or connector changes.
- No persistent recency/ranking database in this iteration.
- No redesign of the Capability Hub or conversation messages.

## Decisions

### 1. Partition pack home entries at render time

`resolvePackEmptyCards` remains the complete catalog source. A new pure helper partitions its output into:

- `recommendations`: non-workflow tasks, capped at four;
- `workflow`: the declared intake/default-workflow task;
- `overflow`: every remaining task.

The game-studio scene order supplies the first three Feishu tasks; the dynamic today-priority task fills the fourth slot after workflow intake is removed. Overflow is not discarded because the command launcher consumes the complete quick-task catalog.

Alternative considered: hard-code four task IDs in the HTML. Rejected because it would bypass capability-pack metadata and regress Skill-driven task replacement.

### 2. Render one flat searchable command collection

The existing quick-menu profile remains a compatibility source, but renderer output is flattened into command records containing task label, description/group label, icon, task ID, prompt and steward action. Search matches normalized label, group and task subtitle. The UI displays all matches as a single result list with lightweight group labels.

Alternative considered: retain the two-column category browser and add a search field. Rejected because categories duplicate the search/navigation hierarchy and make keyboard focus more complex.

### 3. Keep search state ephemeral

Search query, active result index and filtered results live only in the renderer closure. Opening the launcher clears the query and focuses its dedicated input; closing it restores focus to the Composer without touching the Composer draft.

No localStorage/electron-store write is introduced, avoiding startup I/O and migration work. “最近使用” is represented as a visual section only when session-local usage exists; otherwise recommendations/all commands are shown.

### 4. Reuse the existing execution dispatcher

Selecting a command continues through `runQuickAction`, then `runTaskCard` or `runOfficeShortcut`. Search only changes discovery. Connector authorization, material prompts, pending shortcut resume and action dispatch remain unchanged.

### 5. Keep renderer work bounded

Command records are rebuilt only when agent mode or Skill catalog changes. Filtering is a small in-memory string comparison on input; no IPC or model call occurs. The panel uses existing icons and CSS variables, so no dependency, asset preload or additional process memory is introduced.

## Risks / Trade-offs

- [A pack relies on its fifth card being directly visible] → expose it through the launcher and reserve a separate workflow row for workflow-oriented tasks.
- [Dynamic tasks lack useful subtitles] → fall back to their group label and task title; no blank result rows.
- [Search input competes with global composer shortcuts] → stop propagation only while the launcher is open and explicitly restore composer focus on close.
- [Existing tests assert five visible cards] → update them to assert four recommendations plus the separate workflow entry and searchable overflow.
- [Generic modes have no workflow entry] → render only the four-card recommendation grid; do not add an empty workflow row.

## Migration Plan

1. Add pure partition/filter helpers and unit tests.
2. Replace the quick-menu markup/styles and renderer interaction while retaining existing task dispatch.
3. Update empty-state rendering and product smoke assertions.
4. Run test, lint and Electron smoke. Rollback is limited to the three renderer/UI files and related tests; no user data migration is needed.
