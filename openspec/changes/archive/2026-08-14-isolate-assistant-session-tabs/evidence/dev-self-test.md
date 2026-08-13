# Dev self-test: isolate-assistant-session-tabs

- Date: 2026-08-12
- `npm test`: 1722/1722 pass
- `npm run lint`: ok

## Behavior locked

- Workbench on → always workbench session surface (incl. expert/workflow chat rooms)
- Workbench expert start uses `surface: 'workbench'` + `taskRef.kind=workbench-task`
- Load migrates workbench-owned sessions out of assistant `openIds`
- Assistant rail restores only agent surface tabs
