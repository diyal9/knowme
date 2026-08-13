## Why

助理界面打开大量 Session Tab 时，顶栏出现明显的横向滚动条，挤占视觉并显得粗糙。用户期望与浏览器/IDE 标签栏一致：溢出时不显示滚动条，用鼠标滚轮横向浏览即可。

## What Changes

- 隐藏 `.agent-tab-scroll` 的可见横向滚动条（仍可溢出滚动）
- 在 Session Tab 条上支持滚轮（含纵向滚轮）映射为横向滚动
- 对齐现有抽屉 Tab / 工作台 manage tabs 的「隐藏滚动条」模式

## 目标用户

日常同时开多个助理/工作台会话的 C 端用户。

## 验收标准

- 多 Tab 溢出时顶栏**不出现**可见横向滚动条
- 指针在 Tab 条上滚动滚轮时，Tab 列表可左右移动并露出被遮挡 Tab
- 点击切换 / 关闭 Tab 行为不变；对话区纵向滚动不受影响（滚轮在 Tab 条外仍滚动对话）

## 非目标（Non-goals）

- 不改 Tab 创建/关闭/持久化逻辑
- 不引入左右箭头按钮或溢出菜单
- 不改其他区域（聊天日志、设置页等）的滚动条样式

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-session-tabs`: 补充 Session Tab 条溢出交互——隐藏可见滚动条、支持滚轮横向浏览

## Impact

- `src/workspace.html`：`.agent-tab-scroll` 样式
- `src/workspace-agent.js`：Tab 条 `wheel` 监听
- `tests/workspace-agent.test.js`：样式/行为断言
