## Context

See proposal.md for why. Current checkout is `refactor/renderer-react-ts` with a React feature tree; uncommitted work already deleted page-level HTML. Oracle: `f6ad048` (`workspace.html` ~4856 lines, `workbench.js` ~12427 lines). Main process stays TypeScript IPC; renderer never uses `ipcRenderer`.

## Goals / Non-Goals

**Goals:**

- Reuse baseline CSS class names and tokens in React so layout matches without a visual rewrite.
- Wire store actions to existing IPC; extend `src/shared/api.ts` to match preload.
- Deliver by surface waves so each wave is screenshot-testable.

**Non-Goals:**

- VM-loading `workbench.js`.
- Restoring note BrowserWindows.
- Splitting remaining `src/lib` god files in this change (only if a file must grow past 400 lines).

## Decisions

### 1. CSS-first parity, React structure second

**Choice:** Port baseline `workbench-layout.css` / `workbench-shelf.css` / `workbench-console.css` / workspace chrome / hub CSS into `src/renderer/styles/**` (already started) and keep the same DOM class names (`wb-head`, `rail-btn`, `hub-app`).

**Alternative:** New design-system components with different class names — rejected; pixel match would drift.

### 2. Capability wiring before chrome polish on the same surface

**Choice:** For each surface, connect real IPC, then match empty states, icons, motion.

**Alternative:** CSS-only pass first — rejected; users already see hollow rooms (Run fake logs, local sessions).

### 3. File mentions map to sources tree

**Choice:** Implement `fileCatalog` load via `sourcesTree` / children; do not add a new `agentFileCatalog` IPC unless sources APIs cannot express the catalog.

**Alternative:** Restore note-id catalog — rejected (notes retired).

### 4. Electron boundary

Renderer: `window.api` only. Preload: expose what IPC still handles; **remove** dead note bridges that hit deleted handlers. Main: no new windows except existing workspace / settings / memory / log-viewer / toast.

## Risks / Trade-offs

- [Risk] 1:1 of 248 workspace ids in one PR → **Mitigation:** waves in tasks.md; each wave has a screenshot folder.
- [Risk] Baseline CSS + React extra wrappers shift layout → **Mitigation:** keep ids/classes from `f6ad048`; avoid extra layout divs.
- [Risk] Memory: baseline memory window still `focusNote` → **Mitigation:** click opens file in sources tree or no-ops with copy path; no note window.
- [Risk] Large store → **Mitigation:** keep feature slices; do not grow a single file past 400 lines.

## Migration Plan

1. Inventory (surfaces.md) frozen as QA oracle.
2. Wave A chrome → Wave B workbench rooms → Wave C assistant → Wave D hub/settings/logs.
3. Rollback: revert renderer feature commits; IPC semantics unchanged so `f6ad048` binary is still the fallback checkout.

## Open Questions

None that block tasks: notes stay retired; baseline is `f6ad048`.
