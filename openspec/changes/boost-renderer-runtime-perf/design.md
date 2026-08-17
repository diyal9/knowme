## Context

四个既有 perf change 已勾完；刻意 Non-Goal 的 CSS 拆包与流式订阅打穿仍在。

## Goals / Non-Goals

- Goals：冷启动可交互明显变快；流式打字机时输入框与历史泡不连带狂刷；本机定时器降频。
- Non-Goals：真虚拟列表；独立 token IPC；改产品文案。

## Decisions

1. **CSS**：`WorkspaceApp` 只保留 tokens + chrome + overlays + legacy-bridge。`workbench-layout` / `console` / `shelf` / `capability-hub` / `secondary-dialog` 由对应 surface `useEffect` 动态 `import()`，`ensureSurfaceCss` 去重。
2. **Composer historyTokens**：订 `messages.length` + 会话切换时从 store 读一次文本估算，或订派生字段 `assistantHistoryTokenEstimate`；禁止订整表 messages。
3. **memo**：`AssistantPane` 用 `useCallback` 包 `runFollowUp` / `runStructuredPick`。
4. **liveNow**：默认 `500`（`preload` 与 hook fallback）；`KNOWME_UI_THROTTLE` 仍用策略值。
5. **fileCatalog**：`AssistantPane` mount 不调用；`AgentComposer` 打开 @ 或 slash 需要文件时、或 `filesOpen` 时再 `loadFileCatalog`。
6. **applyStreamEvent**：与 chunk 共用 pending + rAF flush；结束/detach 强制 flush。

## Risks

- FOUC：切到工作台首帧可能无完整样式 → 动态 import 后立即生效；保留 chrome 壳样式。
- @ 空态：首次按 @ 触发加载，菜单可短暂为空。
