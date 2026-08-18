## Context

见 proposal.md。当前 blob 预览：`esc(content)` 塞进 `<pre class="wb-ws-code">`。仓库已有 `marked` + `DOMPurify`（便签/编辑器用），知识库有 `.knowledge-markdown` 排版；工作台页尚未引入。无 highlight.js / Prism。

## Goals / Non-Goals

**Goals:**
- 会话缓存 + Git 树着色（同前）。
- 按扩展名分流：Markdown 文档面、代码语法面、纯文本降级；安全（转义 / sanitize）。
- 视觉与工作台一致：浅底、清晰字阶、语言角标，不做成第三套 IDE 皮肤。

**Non-Goals:**
- 可编辑、全语言 LSP、主题切换器。

## Decisions

1. **渲染进程 LRU**（同前）：tree/blob 分 Map；刷新/关窗/换仓 clear；blob ≤32 条 / ~8MB。

2. **着色数据源**：`projectChanges(run.changes)`；路径归一化 + 后缀匹配。

3. **类型预览模块 `workspace-blob-preview.js`（可测、无 Node 依赖）**  
   - `detectKind(path)` → `markdown` | `code` | `text` | `binary`  
   - 扩展：`.md/.markdown` → markdown；`.go/.ts/.tsx/.js/.jsx/.mjs/.cjs/.json/.css/.html/.py/.yaml/.yml/.sh` 等 → code(+lang)；其余文本 → text  
   - `renderPreview({ path, content, isBinary })` → `{ html, kind, langLabel }`  
   - Markdown：`marked.parse` + `DOMPurify.sanitize`（页面已加载 vendor；模块内探测 `window.marked` / `DOMPurify`，缺失则 escape 纯文本降级）  
   - 代码：自研轻量 highlighter（注释 / 字符串 / 数字 / 关键字按 lang 表），输出 `<pre class="wb-ws-code language-go">…</pre>`，**禁止**未转义插入  
   - Alt：整包 highlight.js → 体积大且多语言用不上；本 Story 用轻量自研 + 可测关键字表。

4. **UI 壳**  
   - blob 区顶部可选一行：`语言标签`（已有 path 在 `wbWsBlobPath`）  
   - Markdown 容器：`.wb-ws-md`（复用知识库排版变量，字号略紧凑）  
   - 代码：保留等宽 + tab-size；token class：`.tok-kw` / `.tok-str` / `.tok-cmt` / `.tok-num`

5. **脚本加载**  
   - `workspace.html` 增加 `marked.umd.js`、`purify.min.js`、`lib/workspace-blob-preview.js`（在 workbench.js 前）。

## Risks / Trade-offs

- [高亮不全] → 未知语法降级纯文本，仍可读。  
- [MD XSS] → 必须 DOMPurify；无库则不渲染 HTML。  
- [缓存陈旧] → 刷新必清。  
- [路径对不上不着色] → 中性色，不瞎标。

## Migration Plan

纯前端；回滚删除 preview 模块与 CSS 即可。

## Open Questions

无。
