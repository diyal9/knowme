## 1. Capability Hub — in-app confirmation

- [x] 1.1 Add a promise-based in-app confirm/prompt dialog to the hub shell with keyboard confirm, Escape cancel and focus restore.
- [x] 1.2 Replace install precheck, high-risk and trust `window.confirm` calls with the dialog, surfacing risk reasons, dependency issues and compatibility.
- [x] 1.3 Replace the legacy-skill migration `window.prompt` with the dialog's input form.

## 2. Capability Hub — skill first-run loop

- [x] 2.1 Load the display-safe skill task catalog and render the tasks a skill declares in its detail drawer.
- [x] 2.2 Add the try action: install and enable when needed, then request a new chat prefilled with the task prompt.
- [x] 2.3 Handle the empty and failure cases without closing the drawer.

## 3. Capability Hub — composition visibility

- [x] 3.1 Show the skills and connectors an expert is composed of, with links to their details.
- [x] 3.2 Show the experts that use a skill, with links back to them.
- [x] 3.3 Fall back to explanatory copy when composition cannot be resolved.

## 4. Workspace bridge

- [x] 4.1 Handle `capability-hub-start-skill` in the workspace message bridge with id validation and structured replies.
- [x] 4.2 Add the agent-side entry that opens a session and prefills the composer without sending.

## 5. Studio — authoring

- [x] 5.1 Add a skill picker to the step inspector writing into the node profile `skillRefs`.
- [x] 5.2 Persist node skill selections through save and reload, keeping the step card count in sync.
- [x] 5.3 Guard unsaved drafts on back-to-shelf, workflow switch and mode-tab switch with save / discard / cancel.

## 6. Studio — layout and keyboard

- [x] 6.1 Fix the 1051–1100px breakpoint conflict so the inspector never disappears.
- [x] 6.2 Make step cards focusable and add keyboard reordering that keeps focus on the moved step.
- [x] 6.3 Remove element references and listeners that no longer have DOM counterparts.
- [x] 6.4 Surface the step skill picker outside the advanced fold, collapse the workflow block while a step is selected, and stop long agent descriptions from breaking the library list.

## 7. Verification

- [x] 7.1 Add `tests/polish-capability-and-workflow-authoring.test.js` with static contracts for the new behaviour.
- [x] 7.2 Run `npm test` and `npm run lint`; record dev self-test evidence.
- [x] 7.3 Verify both surfaces in the running app at desktop and narrow widths; record evidence (`evidence/ux-polish-desktop-smoke.js`).
