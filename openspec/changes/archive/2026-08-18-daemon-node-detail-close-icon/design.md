## Context

节点详情由 `renderDaemonStepDetail` 渲染；退出靠 `[data-step-detail-back]` 清空 `daemonReviewStepId`。见 `proposal.md` Why。仅改渲染层与 CSS，无 IPC / 主进程变更。

## Goals / Non-Goals

**Goals:**
- 关闭控件与工作台 `wb-icon-btn` + `data-icon="close"` 一致
- 控件贴详情区右上角，不抢标题注意力

**Non-Goals:**
- 不改 `daemonReviewStepId` 状态机
- 不抽公共组件库

## Decisions

1. **保留 `data-step-detail-back`**：现有 click 委托与测试依赖该属性；仅改视觉与文案。
2. **布局**：详情容器相对定位，关闭按钮 `position:absolute; top/right`，避免挤占标题行；标题区不再为返回按钮留左侧行。
3. **图标**：复用 StickyIcons `close`，与抽屉/模态关闭一致；不用 `×` 字符以免字号漂移。

## Risks / Trade-offs

- [Risk] 绝对定位与进度条间距过紧 → Mitigation：保留详情 `padding-top` 或给关闭按钮预留 28px 触控区
- [Risk] 测试仍断言旧文案 → Mitigation：更新断言为 close icon / aria-label

## Migration Plan

无数据迁移；热重载/重启 Electron 即可验证。回滚即还原按钮 HTML/CSS。
