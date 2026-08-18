## Context

`unify-rich-content-views` 将飞书卡片迁到 React，但明确未重做右侧预览，点击改成 `<a target="_blank">`。旧 `workspace.js` 的 `openLink` + `persist:knowme-preview` webview 随 DOM 壳删除后未迁回。

## Decisions

1. **Store**：`linkPreview: { href, title, protocol, isFeishu } | null` + `linkFullscreen: boolean`，动作 `openLinkPreview` / `closeLinkPreview` / `setLinkFullscreen`。
2. **UI**：`LinkPreviewSurface` 挂到 `AppShell` 的 `#main`（与 `AssistantPane` 并列），复用 `.pane-wrap.surface-link` 与工具栏 CSS。
3. **嵌入**：运行时 `document.createElement('webview')`，避免 JSX 对自定义标签的类型摩擦；`partition="persist:knowme-preview"`。
4. **点击**：非 chat 卡片左键 `preventDefault` → `openLinkPreview`；chat 仍 `openExternal`；`knowme://feishu/auth` 走设置连接器。
5. **全屏**：`app` 根加 `link-preview-fullscreen`；`#workSurfaceWrap` 使用 `top: var(--titlebar-height)`（不可 `inset:0`），避免工具栏落在 titleBarOverlay / 拖拽区下无法点击退出；Esc 退出全屏（关闭预览用工具栏关闭）。

## Risks

- Vitest 无 Electron webview：单测断言 DOM 结构与 store，不加载真实页。
- 用户首次预览仍需在 webview 内登录一次飞书；之后靠 persist partition。
