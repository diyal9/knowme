## Context

当前「你的任务」在渲染进程用 `renderTaskRecentRow` 输出通栏 `.wb-task-row-card`，CSS 为单列 flex；折叠逻辑已由 `collapse-workbench-recent-tasks` 提供（`TASK_RECENT_PREVIEW = 3`）。任务持久化经主进程 `workbench-task-store` IPC，字段含 `title` / `goal` / `status` / `expertName` 等，尚无稳定的卡片级 `resultSummary`。见 proposal.md Why。

## Goals / Non-Goals

**Goals:**
- 渲染侧改为三列卡片网格，卡片内展示执行摘要。
- 收起态高度与预览条数对齐，避免任务首页因最近任务预览产生页面滚动。
- 展开态仅列表容器内滚动。

**Non-Goals:**
- 不引入新 IPC；不强制历史任务回填摘要。
- 不改快捷任务网格与定时调度语义。

## Decisions

1. **布局：CSS Grid 三列**  
   - `grid-template-columns: repeat(3, minmax(0, 1fr))`；`≤1100px` 两列、`≤720px` 一列。  
   - 替代方案：保留通栏 + 缩短高度 → 仍浪费横向空间，否决。

2. **预览条数保持 3**  
   - 三列下一行正好 3 张，卡片虽含摘要，仍可控高度。  
   - 替代：预览 6（两行）→ 摘要行高易顶出首屏，否决。

3. **摘要优先级（纯渲染拼装）**  
   - `resultSummary`（若 store 有）→ 否则 `goal` → 否则状态短句（如「进行中，等待专家继续」）。  
   - 在 `normalizeTask` 中可选归一化 `resultSummary`（短文本），任务状态更新时若调用方传入则持久化；无则卡片仍可用 `goal`。  
   - 全部在渲染进程拼装，不新增 IPC round-trip，避免列表刷新成本。

4. **定时按钮内嵌卡片页脚**  
   - 去掉行外独立「定时」列，改为卡片底部次要按钮，避免破坏三列对齐。

5. **高度策略**  
   - 收起：列表无 `max-height` 滚动（仅 1 行卡片），依赖预览截断。  
   - 展开：`.is-expanded` 设 `max-height` + `overflow-y: auto`，页面级滚动仅作极端兜底。

## Risks / Trade-offs

- [摘要缺失] 旧任务无 `resultSummary` → 回退 `goal`/状态文案，保证卡片不空。  
- [窄窗三列挤压] → media query 降列。  
- [卡片变高顶出首屏] → 摘要 `-webkit-line-clamp: 2` + 预览仅 3。

## Migration Plan

- 纯前端 + 可选字段；旧 JSON 直接可读。  
- 回滚：恢复 `renderTaskRecentRow` 与单列 CSS。

## Open Questions

- （无）
