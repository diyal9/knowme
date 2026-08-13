# Dev self-test: isolate-assistant-workflow-daemon-surfaces

## Commands

- `npm test` → **1727/1727 pass**
- `npm run lint` → **ok**（含 script-scope）

## Code guards landed

- `openAgentChat` / `openWorkbenchHome` / 自动化 rail：`setWorkbenchTaskView(false)` 退出 task-room 并清过程投影
- `setSurfaceMode('agent')` → `setDaemonProcessFeed(null)`
- `paintDaemonProcessFeed` / `restoreDaemonProcessFeedAfterChatRender`：仅 `surfaceMode === 'workbench'` 可绘制
- `isWorkbenchOwnedSession`：`/^工作台\s*[·\-—–]/` + taskRef 变体

## Manual smoke（待制作人）

见 `qa-plan.md` Smoke Scope：Daemon → 助理、工作流对话 → 助理、再回 Daemon。

## Date

2026-08-12
