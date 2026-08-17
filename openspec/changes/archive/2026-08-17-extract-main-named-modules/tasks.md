## 1. 模块落地

- [x] 1.1 新增 `boot.ts` / `agent-runtime.ts` / `shell.ts` / `knowledge.ts` / `workbench.ts`，各导出 `attach(scope)`，合并对应 part 正文且保持相对加载序
- [x] 1.2 `index.ts` 显式 require 具名模块；更新 `module-list.json`；删除全部 `part-*.ts`
- [x] 1.3 文件头注释说明职责与「不负责什么」

## 2. 测试与文档

- [x] 2.1 `tests/helpers/main-ipc-bundle.js` 按 `module-list.json` 拼接，不再 glob `part-\\d+`
- [x] 2.2 `docs/architecture.md` 写明主进程具名模块
- [x] 2.3 `npm run lint` / `npm run typecheck:renderer` 绿；主进程结构测试绿；全量 `npm test` 既有执行器红记入 `evidence/dev-self-test.md`
