## Why

体验/性能是重构后的主验收点。已有 GPU/卫生/首屏 lazy 只把分数拉到「略超基线」；用户要求**大幅度**流畅度提升。勘察显示最大剩余瓶颈是：首屏全量 CSS、流式时 Composer/气泡 memo 失效、liveNow 200ms、助手 mount 仍扇出 fileCatalog。

## What Changes

- 首屏 CSS 按路由/表面懒加载（助手不再吃 workbench/hub/run/shelf 全量样式）
- Composer 切断对整表 `messages` 的订阅；气泡回调稳定化使 `memo` 生效
- liveNow 本机默认间隔提高到 ≥500ms（远程仍走 throttle）
- 助手首屏延后 `loadFileCatalog`（@ 菜单或文件侧栏打开时再拉）
- 非文本 `applyStreamEvent` 与 chunk 同样 rAF/32ms 合并
- 勾选飞书/制作人真机签字相关 acceptance（已完成）

## Capabilities

### New Capabilities

- `renderer-runtime-perf`: 渲染层大幅度运行时性能（CSS 分包、流式重渲、首屏 IPC）

### Modified Capabilities

- （无）

## Impact

- `WorkspaceApp`、各 surface 入口、`AssistantPane` / `AgentComposer` / `AgentMessageBubble` / `store-session`
- 风险：切面 FOUC（可接受短暂）；@ 文件首开空一拍
