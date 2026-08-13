## Smoke Scope（必填）

- [x] Open KnowMe and enter 知识网 → 我的知识
- [x] Verify populated home shows search, compact actions, real material index and secondary recent/health information
- [x] Verify search results open the existing browse view
- [x] Verify 添加资料、检查问题、浏览全部、待评估 and Obsidian actions remain functional
- [x] Verify 760px/narrow window layout has no horizontal overflow
- [x] Verify console has no uncaught error during the flow

## Anti-pattern Checks

- [x] No large promotional hero or duplicate root title
- [x] Material index occupies the primary content area
- [x] No KnowMe graph canvas or internal Fabric/织网 terminology in the default home

## Regression

- `npm test`
- `npm run lint`
- `npx openspec validate polish-knowledge-home-layout --strict`
- Project Electron smoke for the knowledge home
