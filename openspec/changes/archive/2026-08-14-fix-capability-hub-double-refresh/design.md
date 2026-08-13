## Context

`speed-up-capability-hub-open` 引入渐进加载：主目录先渲染，再后台跑 `loadCatalogAuxiliaries`；复用打开走 `capability-hub-resume` → `resumeFromHost`。当前实现里：

1. `loadCatalogAuxiliaries` 在绑定刷新后调用 `renderGrid()` + `renderDrawer()`，而 `workbenchExpertIds` 只影响抽屉 CTA，目录卡片 HTML 不变 → 入场动画重播。
2. `resumeFromHost` 先 `refreshWorkbenchExpertIds` + `renderGrid`，再 `loadCatalog({ soft: true })` 整页 `render()` → 连续两次目录重绘。

## Goals / Non-Goals

**Goals:**

- 主目录卡片在一次打开生命周期内只完整入场一次（骨架除外）。
- resume 同步不造成可见的双重目录刷新，同时仍刷新工作台绑定。

**Non-Goals:**

- 不改 park/reuse 宿主契约。
- 不取消 soft catalog 在安装/卸载成功路径上的用法。

## Decisions

### 1. 辅助补齐只刷抽屉

`loadCatalogAuxiliaries` 完成后仅 `renderDrawer()`。编辑器 catalog / composition 不参与网格 markup；工作台绑定仅改抽屉按钮态。

### 2. resume 单次轻量路径

同 Tab 复用打开：`applyExpertSelection` 后只 `await refreshWorkbenchExpertIds()` + `renderDrawer()`。不调用 `renderGrid`，也不在 resume 路径再 `loadCatalog({ soft: true })`。目录新鲜度仍由安装/卸载/Tab 切换既有路径保证（与 open-perf design 的 mitigation 一致）。

### 3. 测试

静态契约断言：`loadCatalogAuxiliaries` 不含 `renderGrid`；`resumeFromHost` 同 Tab 路径不含 `loadCatalog` / `renderGrid`。

## Risks / Trade-offs

- [Risk] 复用期间外部改了 catalog，再打开短暂看到旧目录 → [Mitigation] 用户切 Tab 或 Hub 内安装/卸载会 `loadCatalog`；可接受。
- [Trade-off] 放弃 resume 时的 soft catalog 拉取，换视觉稳定。
