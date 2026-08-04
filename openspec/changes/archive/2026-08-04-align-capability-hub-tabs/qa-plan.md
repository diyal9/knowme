# QA Plan: align-capability-hub-tabs

## Smoke Scope（必填）

- [x] Electron 真机打开能力 Hub，仅一条外层顶部栏
- [x] 专家 / 技能 / MCP 连接器页签切换与 iframe 深链同步
- [x] 内嵌 Hub 菜单栏隐藏，搜索与筛选直接承接顶部栏
- [x] 内容区无重复类型介绍，目录信息完整
- [x] 控制台无业务 uncaught error

## Regression Scope

- [x] `tests/capability-hub.test.js` 契约未破坏
- [x] npm test / lint 通过
- [x] OpenSpec strict validate 通过

## Anti-pattern Checks

- 双层菜单栏或页签错位
- 窄窗横向溢出导致页签不可点
- 静态预览误报为 Electron 真机通过
