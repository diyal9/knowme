## Why

从工作台切到助理时，Session Tab 栏会短暂闪现工作台的大量任务签页，再收敛为助理自己的签页。根因是 surface 切换后异步加载目标 Session 前，DOM 仍渲染上一 surface 的 `openSessionIds`，造成「产品乱、会话失控」的瞬时感知。

### 目标用户

- 在工作台开过多个任务后，频繁切回助理聊天的日常用户。

### 商业化与体验价值

助理是高频入口；Tab 栏无闪烁直接降低「半成品 UI」观感，强化助理 vs 工作台边界，避免误以为任务签页泄漏回助理。

## What Changes

- surface 切换时，**在首帧绘制前**同步恢复目标 surface 的打开 Tab 集合并重绘 Tab 栏。
- 异步 `activateSession` 仍负责加载对话内容；不得再以「等 IPC 回来再改 Tab」作为唯一更新路径。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-session-tabs`: 增加「surface 切换时 Tab 栏不得闪现另一 surface 打开集合」的体验要求。

## Impact

- `src/workspace-agent.js`：`setSurfaceMode` / `activateSurfaceSession`
- 测试：`tests/workspace-agent.test.js`

### 验收标准

- 工作台打开多个任务 Session 后点「助理」，Tab 栏不出现工作台签页闪现。
- 助理最终仍只显示助理 surface 的打开集合（与 isolate 行为一致）。
- 反向（助理 → 工作台）同样无错误 surface 的 Tab 闪现。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不改变助理/工作台 Tab 隔离语义与持久化结构。
- 不重做 Tab 栏视觉或滚动行为。
- 不预取全部 Session 消息（仅同步换 Tab 集合，内容仍异步加载）。
