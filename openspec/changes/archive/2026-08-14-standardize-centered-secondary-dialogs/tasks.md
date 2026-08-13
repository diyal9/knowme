## 1. Shared dialog foundation

- [x] 1.1 Add a dependency-free shared secondary-dialog stylesheet with centered geometry, internal scroll regions, responsive safe margins and reduced-motion behavior.
- [x] 1.2 Load the shared stylesheet in Workspace and Capability Hub without changing primary full-page surfaces.

## 2. Capability Hub details

- [x] 2.1 Convert the Hub capability detail shell from an edge drawer to an accessible centered dialog while retaining existing element IDs and business actions.
- [x] 2.2 Move primary install/update/uninstall/start actions into a stable dialog footer and preserve connector async details in the scrollable body.
- [x] 2.3 Preserve backdrop, Escape and close-button dismissal and restore focus to the triggering capability card.

## 3. Workspace transient panels

- [x] 3.1 Add a secondary-dialog mode and backdrop for versions and final-prompt preview while preserving knowledge, settings and Capability Hub full-page modes.
- [x] 3.2 Add backdrop/Escape dismissal and focus restoration for Workspace secondary dialogs.

## 4. Verification and evidence

- [x] 4.1 Add static regressions for centered dialog geometry, absence of edge-slide transforms, responsive bounds and primary-surface preservation.
- [x] 4.2 Run OpenSpec validation, test, lint and Electron UI smoke verification.
- [x] 4.3 Record development self-test evidence and mark completed tasks.
