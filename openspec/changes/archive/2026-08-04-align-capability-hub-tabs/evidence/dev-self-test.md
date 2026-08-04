# 开发自测

- `node --test tests/capability-hub.test.js`：4/4 通过
- `npm test`：909/909 通过
- `npm run lint`：通过
- `openspec validate align-capability-hub-tabs --strict --json`：通过
- 工作区集成预览依次切换“专家 / 技能 / MCP 连接器”：父级顶部栏选中态、iframe 深链和页面标题同步；内嵌菜单栏为 `display: none`
- 内容区重复介绍已移除，搜索、筛选、精选区和 Catalog 结果数量保持完整

## Electron 真机（follow-up）

- `node scripts/electron-rail-evidence.js align-capability-hub-tabs`：**PASS**
- 证据：`evidence/electron-evidence.json`、`evidence/screenshots/electron-hub-outer-topbar.png`
- 无 uncaught console error；能力 Hub 外层顶栏与 iframe 内容同步
