## Context

基线 `workspace-agent.js` 用 `MarkdownLite.render` + `renderFeishuLinkCard` 拼 HTML。React 层不能依赖 Vite 无法展开的 CJS IIFE。规则必须在 `domain`，UI 在 `features/content-view`。

## Goals / Non-Goals

- Goals：一份块模型、一套 React 组件与 CSS；助理与知识网先接入。
- Non-Goals：完整 Markdown 方言；飞书预览侧栏；主进程改协议。

## Decisions

1. **解析在 domain**：`parseContentBlocks(src)` 产出 heading/list/paragraph/code/quote/table/hr；行内节点含 text/strong/em/code/link/feishu。飞书判定复用 `src/lib/feishu-link.ts` 的 `parseOpenLink`（补 ESM 具名导出，避免再抄一份分类规则）。
2. **渲染在 feature**：`ContentView` 把块映射为组件。表格 `ContentTable`，飞书 `FeishuResourceCard`。会话气泡会话级 `chat` 资源用紧凑链接（对齐基线 related-chats 可扫性，默认对话用完整卡片）。
3. **HTML 串仍可生成**：`renderKnowledgeMarkdown` 改为 serialize 同一块模型，供非 React 或单测；UI 优先组件而非 `dangerouslySetInnerHTML`。
4. **进程边界**：无新 IPC。链接点击用普通 `<a>`。
5. **性能**：对话每条消息 `useMemo(parseContentBlocks)`；块数量按现有 Markdown 行扫描，不引入 marked。

## Risks / Trade-offs

- 行内解析与 markdown-lite 正则不完全一致 → 用同一套单测夹具（加粗、列表、表、飞书 URL）锁行为。
- `feishu-link` 仍是 CJS + 具名导出双轨，测试 `require` 继续走 `module.exports`。
