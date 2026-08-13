## Context

See proposal.md — Why。专业画布当前由 `workbench-studio-canvas.js` 的 `fieldsFromNode` 生成可编辑 `fields`，`workbench.js` 的 `studioCanvasNodeHtml` / `studioCanvasFieldControlHtml` 在卡片上渲染 select/input/textarea；右侧 `renderStudioInspector` 又渲染同一批绑定。渲染进程内完成，无 IPC 变更。

先前 `surface-specialty-node-expert-bind` 把「执行专家」放进卡片，是为解决「只在属性里、容易漏配」。本 change 用**只读摘要**保留可发现性，用 **Inspector 单一编辑面**消除双入口。

## Goals / Non-Goals

**Goals:**

- 卡片：紧凑、只读、可扫读关键状态
- Inspector：唯一编辑面，字段完整且与摘要同源
- 默认节点高度下降，拓扑更清晰
- 不破坏 specialty 绑定校验与调色板预填

**Non-Goals:**

- 不改主进程 / IPC
- 不改 compile / validate 语义（仅 UI 职责）
- 不重做属性面板信息架构

## Decisions

### 1. 画布只读摘要，不保留任何内联表单

- **选择**：卡片 body 用 `sections`（只读行/短文本），不再渲染 `data-studio-inline` 控件；标题用 `<strong>` 只读，改名仅在属性面板。
- **理由**：双入口是心智问题根因；标题内联改名也会抢焦点、干扰拖拽选中。
- **备选**：卡片保留「检索问题」一个主输入 → 仍双入口，拒绝。
- **备选**：双击弹模态 → 与现有 Inspector 冲突，拒绝。

### 2. 摘要内容（按 kind）

| Kind | 摘要行（示例） |
|------|----------------|
| knowledge | 专家：ArtBundle… / 知识库：未选择 / 输入：检索问题… |
| tool | 专家… / 技能… / 目标摘要 |
| llm | 专家… / 模型… / Prompt 首行摘要 |
| agent | 输入 / 目标 / 输出（短） |
| condition | 左值 · 比较 · 右值 |
| start/end | 既有 IO 标签 |

未绑专家显示「未绑定专家」（弱警示色），引导点选后去属性面板。

### 3. `fieldsFromNode` 职责

- **选择**：`fieldsFromNode` 改为仅服务摘要投影（或拆 `summaryFromNode`），canvas 渲染走 sections；Inspector 继续自有 HTML，不依赖 canvas fields 的可编辑类型。
- **理由**：避免「同一 fields 又摘要又编辑」混用。
- **备选**：fields 加 `readonly: true` 仍走 inline 渲染 → 易残留控件事件，拒绝。

### 4. 尺寸

- `sizeForNode` 按摘要行数估算，目标 knowledge 卡约 96–128px 高（现内联表单更高），宽度不变。

### 5. 与 expert-bind 的关系

- 调色板预填 `agentPackageId` **保留**。
- Spec 从「卡片上暴露 select」改为「卡片展示绑定摘要；编辑在 Inspector」。

### 6. Electron 边界

- 仅渲染进程 UI（`workbench.js` + canvas lib + CSS）。无主进程、无额外内存路径；更少 DOM 控件，略减重绘成本。

## Risks / Trade-offs

- [Risk] 用户习惯在卡片上改专家 → Mitigation：选中即展开属性；摘要行文案「点选后在右侧编辑」仅在 idle 提示里出现，卡片本身不堆 hint。
- [Risk] 未绑专家更难发现 → Mitigation：摘要「未绑定专家」+ 既有 validate 拦截。
- [Trade-off] 少一次「卡片内快改」→ 换统一心智与整洁度，符合编排主路径。

## Migration Plan

- 纯 UI；草稿 schema 不变。
- 回滚：恢复 fields 可编辑渲染即可。

## Open Questions

（无 — 标题是否卡片可编已定为否，统一走 Inspector。）
