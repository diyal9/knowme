# 开发自测 — simplify-knowledge-reading-layout

## 结论

知识网「我的知识」由三栏改为两栏（左资料树 + 右阅读/编辑），硬门禁全绿，Electron 闭环 7/7，控制台 0 报错。

## 命令与结果

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npm test` | 1574 / 1574 通过 |
| Lint | `npm run lint` | lint ok · script-scope ok |
| 知识专项 | `node --test tests/knowledge-web-naming.test.js tests/knowledge-page-refactor.test.js tests/knowledge-governance-onboarding.test.js` | 16 / 16 通过 |
| Electron 闭环 | `node openspec/changes/simplify-knowledge-reading-layout/evidence/knowledge-two-pane-electron-smoke.js` | 7 / 7 通过 |

## Electron 检查项

| 检查 | 结果 |
|---|---|
| `knowledge-home-has-two-panes` | PASS（grid 2 列、无 `#kosContext`、树在阅读区左侧、阅读区更宽 864px） |
| `topbar-does-not-print-absolute-path` | PASS（顶栏副标题为「资料保存在本机，可随时打开编辑」） |
| `read-only-entry-keeps-metadata-and-actions-in-doc-head` | PASS（路径 / 只读阅读 / 交给 AI 整理 / 查看提案 都在文档头） |
| `raw-entry-gets-wide-editor-and-check-action` | PASS（raw 文档宽 854px，编辑 + 预览双栏可读） |
| `raw-safe-save-still-works` | PASS（未保存 → 已安全保存） |
| `narrow-layout-stacks-without-overflow` | PASS（510px 视口，`body.scrollWidth = 510`，阅读区在树下方） |
| `no-renderer-errors-in-knowledge-flow` | PASS（consoleErrors 0 / pageErrors 0） |

## 变更要点

- `renderKnowledgeStatusWorkspace`：删除 `#kosContext` 侧栏，栅格 `272px minmax(0,1fr)`。
- 新增 `knowledgeDocActionsHtml` / `wireKnowledgeDocActions`，条目动作跟随文档头；删除 `knowledgeContextHtml` / `renderKnowledgeContext`。
- 只读文档头补「只读阅读」标签，元信息不再重复。
- `knowledgeTopbarHtml` 不再整行输出知识库绝对路径，路径保留在 `title`。
- 资料树顶层目录改用中文标签（`raw` → 资料、`concepts` → 已整理知识）。
- raw 文档最大宽度放宽到 1080px，避免「编辑 + 预览」被压。

## 截图

- `screenshots/knowledge-two-pane-desktop.png`
- `screenshots/knowledge-two-pane-narrow.png`

## 备注

首次运行旧版 `rebuild-root-llmwiki-workbench` 冒烟时曾捕获一条 `btnShelfNewWorkflow is not defined`；本次改造后的闭环连续两次运行均为 0 报错，未复现。
