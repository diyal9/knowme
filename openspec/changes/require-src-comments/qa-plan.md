# QA Plan — require-src-comments

## Smoke Scope

- 打开 `.cursor/rules/source-comments.mdc`：三类 MUST + MUST NOT 废话
- 打开 `src/ipc/ai-generate.ts`、`agent-context-orchestrator.ts`、`agent-generate-child-ports.ts`：有文件头与导出注释
- 不回归：`npm test` / `npm run lint`

## 反模式

- 注释复述代码 → 不合格
- 未改动的存量文件无头注释 → 本 Story 不 BLOCK
