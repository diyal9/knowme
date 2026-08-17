## 1. 约定

- [x] 1.1 新增 `.cursor/rules/source-comments.mdc`（文件头 / 导出函数 / 常量；禁废话）
- [x] 1.2 `architecture.mdc` 与 `docs/architecture.md` 增加 MUST，指向注释约定

## 2. 生成主链路示范

- [x] 2.1 `src/ipc/ai-generate.ts`：文件头、`registerAiGenerateIpc`、`AI_GENERATE_REQUIRED_DEPS`
- [x] 2.2 `src/lib/agent-context-orchestrator.ts`：文件头、`buildMemoryPolicy` / `buildDynamicContext`、预算常量
- [x] 2.3 `src/lib/agent-generate-child-ports.ts`：文件头、`createChildRunPortFactory` / `makeOrchestrationPort`
- [x] 2.4 `src/lib/agent-generate-libs.ts`、`prepare`、`tool-surface`、`execute`：文件头 + 导出函数

## 3. 自测

- [x] 3.1 `npm test` 与 `npm run lint` 通过，写 `evidence/dev-self-test.md`
