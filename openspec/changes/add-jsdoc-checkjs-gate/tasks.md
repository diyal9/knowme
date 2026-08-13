## 1. 类型检查基建

- [x] 1.1 新增 `jsconfig.json`（checkJs，窄 include）
- [x] 1.2 新增 `scripts/check-jsdoc.js` + `npm run typecheck`
- [x] 1.3 harness check/doctor advisory 接入

## 2. 示范标注

- [x] 2.1 为 `src/lib/workbench-daemon-errors.js`（或同等高频模块）补最小 JSDoc
- [x] 2.2 确认 typecheck 可运行（允许存量 error，记录基线）

## 3. 自测

- [x] 3.1 写 `evidence/dev-self-test.md`
- [x] 3.2 `npm test` / `npm run lint` 仍通过
