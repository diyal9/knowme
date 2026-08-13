## Context

See proposal.md - Why。工作台窗口使用 `titleBarStyle: 'hidden'` + Win `titleBarOverlay`；渲染层 `.app-chrome-drag` 目前为空拖拽层。`.main` 使用 `--bg-card` 与 `border-top-left-radius:12px`，工作台画布另设 `--wb-bg` 与径向渐变；中心覆盖层 `border-radius:0`。

边界：仅渲染层 HTML/CSS；主进程窗口配置不变；无新 IPC。

## Goals / Non-Goals

**Goals:**
- 顶栏展示产品品牌，且保持可拖动。
- 助理 / 工作台 / 自动化外层画布同色。
- 主岛与中心覆盖层共享同一左上圆角 token。

**Non-Goals:**
- 不改 BrowserWindow 尺寸、overlay 高度或系统按钮样式。
- 不把任务栏 ICO / tray PNG 重生成。
- 不统一所有内部卡片灰底。

## Decisions

1. **品牌落在 `.app-chrome-drag` 内**  
   用紧凑 icon（内联 SVG，与 FAB 同源几何）+「KnowMe」文字，左对齐于标题栏拖拽区；`-webkit-app-region: drag` 保留在容器上。  
   备选：放进 rail 顶部 — 会挤占导航，且用户指向的是顶栏空白。

2. **内容画布对齐 `--bg-card`**  
   将 `--wb-bg` 设为 `var(--bg-card)`，并去掉工作台径向灰渐变（或降为几乎不可见），使工作台外层与助理一致。内部 surface 卡片仍用白底 + 边框分层。  
   备选：把助理改成灰底 — 与用户明确要求相反。

3. **圆角用单一 CSS 变量**  
   新增 `--content-island-radius-tl: 12px`，`.main` 与 `mode-center-surface` 覆盖层共用；覆盖层背景也改为 `--bg-card`，避免灰底 + 直角与主岛冲突。

## Risks / Trade-offs

- [工作台灰底去掉后卡片层次变弱] → 保留卡片边框与 `--wb-surface-subtle` 行底，仅改外层。
- [顶栏品牌与 rail「文件」视觉抢焦点] → 品牌字号克制（~12px）、图标 ~16–18px，不放 CTA。
- [titlebar-area 环境变量在非 Win 为 0] → 品牌随 `--titlebar-height` 隐藏/高度为 0 时不占位；mac hidden titlebar 仍可用固定高度或现有 env。

## Migration Plan

热重载 / 重启 KnowMe 即可；无数据迁移。回滚：还原 CSS 变量与 HTML 品牌块。
