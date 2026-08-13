## Smoke Scope（必填）

- [x] Open KnowMe and enter 知识网 → 我的知识
- [x] Verify the default view is a three-pane root LLMWiki workbench
- [x] Verify raw material opens in the center editor with source context on the right
- [x] Verify raw unsaved state and safe save remain available
- [x] Verify organized concepts open read-only
- [x] Verify refresh, issue check, add material, source and Obsidian actions remain reachable
- [x] Verify 760px/510px narrow layout has no horizontal overflow
- [x] Verify renderer console has no uncaught error during the flow

## Anti-pattern Checks

- [x] No status-card dashboard or promotional hero on the default populated root
- [x] Material tree is the primary navigation surface
- [x] No KnowMe graph canvas or Fabric/anchor/authority internal terms in the default workbench

## Regression

- `npm test`
- `npm run lint`
- `npx openspec validate rebuild-root-llmwiki-workbench --strict`
- `node openspec/changes/rebuild-root-llmwiki-workbench/evidence/llmwiki-workbench-electron-smoke.js`
