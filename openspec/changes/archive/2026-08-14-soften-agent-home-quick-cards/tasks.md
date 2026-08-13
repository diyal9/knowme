## 1. Pack empty-state config

- [x] 1.1 Set `workflow-intake.showInEmptyState` to `false` in `src/packs/game-studio/scenes.json`
- [x] 1.2 Update `tests/game-studio-scenes.test.js` empty-state id expectations

## 2. Soften home recommendation cards

- [x] 2.1 Add light-weight styles scoped to `.agent-empty-home .agent-empty-act` in `src/workspace.html`
- [x] 2.2 Confirm expert/steward empty-state cards keep default `.agent-empty-act` weight

## 3. Verification

- [x] 3.1 Run `npm test` and `npm run lint`
- [x] 3.2 Write `evidence/dev-self-test.md`
