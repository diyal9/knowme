# Design: push-refactor-score-to-90

## Decisions

1. `workspace-chrome.css` → shell / `knowledge-chrome.css`（knowledge 路由懒加载）/ `agent-chrome.css`（默认静态）。
2. `workbench-layout.css` → core + `workbench-studio.css` + `workbench-daemon.css` 按面加载。
3. 助理 MESSAGE_PAGE=24；非流式 ContentView lazy；Context Usage 标注估算/会话用量；`AgentContextInfo` 进 `shared/api.ts`。

## Risks

- 切知识/Studio 极短 FOUC；工作台预热 daemon/shelf/console 样式以降低闪烁。
