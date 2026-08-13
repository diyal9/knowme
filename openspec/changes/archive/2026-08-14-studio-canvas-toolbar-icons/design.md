## Context

编排画布顶栏目前只有标题 + 右侧文字动作。自由画布已有 `autoLayoutBoard` / 视口 fit，但未暴露为顶栏工具。

## Goals / Non-Goals

- Goals: 图标化右侧动作；左侧布局工具可一键整理与简单对齐；可访问性保留文案
- Non-Goals: 多选框选、撤销、网格吸附 UI

## Decisions

1. **工具栏三段**：左 `wb-studio-tools` · 中标题 meta · 右 `wb-studio-actions`
2. **右侧图标**：`list`/`network`（模式切换）、`clipboardCheck` 或 save 图标、`play`（测试运行）；无 save 图标则新增 Lucide `save`
3. **左侧工具**（仅专业画布）：
   - `auto-layout` 一键整理：强制 `autoLayoutBoard` 写回所有节点 x/y，标记 dirty，再 fit
   - `align-left` / `align-top` / `align-center-h`：对当前选中节点（若仅 1 个则对全部非空布局节点）对齐
   - `fit`：复用现有 `fitStudioView`
4. **轻量步骤**：左侧布局工具隐藏或 disabled，避免无效操作
5. **布局算法**：对齐在 `workbench-studio-canvas.js` 导出纯函数，便于单测

## Risks / Trade-offs

- 「选中 1 个则对齐全部」可能出乎意料 → toast 说明「已按画布节点对齐」
- 一键整理会打乱手工微调 → 接受为显式操作

## Migration

无数据迁移。
