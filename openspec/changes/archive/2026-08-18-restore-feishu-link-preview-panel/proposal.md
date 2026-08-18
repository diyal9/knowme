## Why

助理对话里点击飞书妙记/文档卡片后，当前用 `target="_blank"` 打开系统窗口，飞书登录态丢失，出现「没有权限访问」弹窗。重构前是右侧 KnowMe 内置浏览器（`webview` + `persist:knowme-preview`）。规格 `feishu-rich-resource-cards` 已要求右侧预览，属回归修复。

## 目标用户

在助理里点开会议妙记、飞书文档的知识工作者。

## 验收标准

- 左键点击飞书资源卡片（含妙记）在右侧打开内置浏览器预览，不弹系统空白窗/飞书无权限 modal。
- 预览使用 `partition="persist:knowme-preview"` 的 webview。
- 工具栏保留全屏、外部打开、复制、关闭；Esc 退出全屏。
- chat AppLink 仍走外部/客户端打开，不进右侧预览。

## 非目标

- 不重做飞书授权 CTA 流程。
- 不恢复文档审阅 surface-review。
- 不改 CLI 读妙记 ACL / draft_minute_permission。

## What Changes

- 恢复 React 版 LinkPreviewSurface + store。
- FeishuResourceCard 拦截左键 → openLinkPreview。

## Capabilities

### Modified Capabilities

- `feishu-rich-resource-cards`: 恢复右侧预览打开路径。

## Impact

- `src/renderer/features/link-preview/`、`FeishuResourceCard`、`AppShell`、app store
- 复用既有 `workspace-chrome.css` 与主进程 `webviewTag`
