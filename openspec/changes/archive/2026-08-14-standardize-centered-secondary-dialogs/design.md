## Context

See `proposal.md` for motivation. Renderer UI is native HTML/CSS/JS and currently has several independent modal patterns. Capability Hub runs in an iframe and uses `hub-drawer` as a fixed right-side panel; Workspace reuses one `drawer` element for both transient side panels and primary full-page surfaces. Business actions and data loading already work and must remain unchanged.

The change is renderer-only. Electron main-process handlers, preload APIs, IPC payloads and `%APPDATA%\KnowMe\` storage remain untouched. The design must avoid new dependencies, additional renderer processes, startup network requests or large persistent DOM trees.

## Goals / Non-Goals

**Goals:**

- Establish one lightweight CSS shell for centered secondary dialogs across renderer pages.
- Convert Hub details and Workspace transient panels without rewriting their business logic.
- Preserve full-page Workspace surfaces by explicitly separating primary-surface mode from secondary-dialog mode.
- Keep long content usable with bounded height, internal scrolling and stable header/footer.
- Preserve keyboard, backdrop and close-button dismissal, including focus return.

**Non-Goals:**

- Do not merge all dialog state into a new JavaScript framework or component runtime.
- Do not alter Workbench workflow launch, automation or command-palette information architecture.
- Do not convert persistent inline panes or primary navigation surfaces into modal dialogs.
- Do not change main-process, preload or IPC contracts.

## Decisions

### 1. Use a shared CSS primitive with local business markup

Add a small renderer stylesheet that defines `secondary-dialog-mask`, `secondary-dialog`, `secondary-dialog__head`, `secondary-dialog__body` and `secondary-dialog__foot`. Capability Hub and Workspace attach these classes to existing elements while retaining their current IDs and business-specific classes.

This centralizes geometry, motion, spacing and responsive behavior without introducing a JavaScript component lifecycle. Existing selectors and event handlers remain compatible.

**Alternative considered:** duplicate new centered styles in `workspace.html` and `capability-hub.css`. Rejected because the formats would drift again and would not satisfy the global consistency goal.

### 2. Separate Workspace primary surfaces and secondary dialogs by shell mode

Workspace continues to reuse the existing `drawer` DOM node, but `openDrawer()` sets `mode-secondary-dialog` for transient content and opens a sibling backdrop. `openCenterSurface()` sets `mode-center-surface` and keeps the full-page overlay contract for knowledge, settings and Capability Hub.

Primary-surface selectors remain more specific and continue to own full-page geometry. Closing clears both modes and the backdrop state.

**Alternative considered:** create a second independent Workspace modal DOM tree. Rejected because callers write directly to `drawerBody`; duplicating targets would increase state branching and regression risk.

### 3. Keep Hub business names but change its semantic shell

Hub keeps `openDrawer`, `closeDrawer` and existing element IDs to minimize code churn, while the markup becomes a `role="dialog"` centered shell. Main capability actions move to a stable footer; connector-specific previews remain in the scrollable body.

**Alternative considered:** rename every drawer symbol to dialog in one pass. Rejected as a broad mechanical refactor unrelated to visible behavior; naming cleanup can happen after the UX contract is stable.

### 4. Use opacity, scale and vertical offset only

The shared entry animation uses opacity plus a small centered scale/vertical offset. It never translates from a viewport edge. `prefers-reduced-motion` disables the transition.

### 5. Restore focus to the triggering control

Each host records `document.activeElement` before opening a secondary dialog, focuses the close control after rendering, and restores the prior connected element on close. Existing Escape and backdrop behavior remains.

## Risks / Trade-offs

- **[Risk] Workspace reuses one element for primary and secondary surfaces** → Scope all centered geometry under `mode-secondary-dialog`, clear inline fallback styles before opening, and keep `mode-center-surface` overrides authoritative.
- **[Risk] Hub has duplicate historical drawer CSS blocks** → Load the shared primitive after page-specific CSS and remove edge-slide geometry from both drawer blocks so later cascade changes cannot revive it.
- **[Risk] Long connector details can hide actions** → Move primary capability actions into a fixed dialog footer while keeping asynchronous connector extras in the body.
- **[Risk] Narrow windows can overflow metadata grids** → Constrain width with viewport safe margins and collapse key/value and multi-column content in the shared narrow breakpoint.
- **[Trade-off] Existing function and class names still include “drawer”** → Retained for minimal behavioral risk; semantic ARIA and visible presentation are corrected now.

## Migration Plan

1. Add the shared secondary-dialog stylesheet and load it in Workspace and Capability Hub.
2. Update Hub detail markup, action footer and focus behavior.
3. Add Workspace secondary-dialog backdrop/mode and generic dismissal behavior.
4. Add static regressions for centered geometry, no edge-slide transform, responsive bounds and primary-surface preservation.
5. Run unit/integration tests, lint and Electron smoke verification.

Rollback is file-local: remove shared classes/style links and restore the previous Hub/Workspace side-panel CSS. No data migration is required.
