## Context

工作台 `wb-head` 在任务/货架面承载模式 Tab；Studio/Run 为「全屏子页」时 Tab 已隐藏，但未注入子页导航，导致顶栏空洞、二级 topbar 重复占高。

## Goals / Non-Goals

**Goals:**

- Studio 激活时顶栏左侧显示：「编排工作流」→ 可选 meta
- 返回统一使用顶栏右侧 `#wbReload`（与任务间一致），避免左右双返回
- 离开 Studio 后顶栏恢复模式 Tab / 货架工具，互不影响
- 画布工具条（轻量步骤 / 保存 / 测试运行）仍在画布区，组件库与节点类型不变

**Non-Goals:**

- 不重写画布引擎、不改节点 schema、不迁入 agentUniverse 源码
- 不改 Run 面顶栏（本次仅 Studio）

## Decisions

1. **导航挂在 `wb-head`**：新增 `.wb-studio-head-nav` 容器（title + meta），`syncModeTabs` / `setSurface` 时切换 `hidden`。
2. **删除 `.wb-studio-topbar` DOM**：避免双层标题，meta 改由 `#wbStudioTopMeta` 位于顶栏。
3. **返回在右侧**：编排态由 `syncHeadActionButton` 显示 `#wbReload` 为返回图标，点击走 `confirmLeaveStudio`；不再使用左侧 `#wbStudioBack` 文案按钮。

## Risks / Trade-offs

- 顶栏在窄窗可能挤：title 省略号 + meta 可隐；动作仍在画布 toolbar。
