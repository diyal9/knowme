## Why

助理只剩一个 Session Tab 时点 `×` 无效果：渲染层在「关完变空」时故意保留旧 Tab，忽略主进程已新建空白 Session 的返回值。同时 Tab 左缘缩进、关闭钮仅 hover 显隐且圆形底与系统其它关闭控件不一致，重构后观感漂移。

## What Changes

- 关闭最后一个打开 Tab 时，采纳主进程 `agent-session-close-tab` 新建的空白 Session 并激活（不再吞掉关闭）
- 关闭多个 Tab 导致打开集合为空时，同样保证落到一个可用空白 Session
- 对齐 Session Tab 左缘与关闭 `×`：激活态常显、样式贴近系统 `.tab-close` / drawer 关闭，去掉「只 hover 才出现 + 圆形底」的违和感

## 目标用户

日常在助理顶栏开关对话的知识工作者；需要「关完还能立刻开聊」与熟悉的桌面 Tab 手感。

## 验收标准

- 仅一个 Tab 时点 `×`：该会话从打开集合移除，自动出现并激活一个新的空白 Tab
- 激活 Tab 的 `×` 无需悬停即可看见；hover 反馈与系统关闭钮同族（小直角圆角、浅底，非大圆斑）
- Tab 列表贴齐助理内容区左缘，无明显多余左缩进
- `npm test` / `npm run lint` / `npm run typecheck:renderer` 通过

## 非目标（Non-goals）

- 不删除磁盘上的 Session 历史（仍是关 Tab 非删会话）
- 不重做整条 Tab 栏视觉语言或历史菜单
- 不改工作台任务签页行为

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-session-tabs`: 补齐「关最后 Tab → 自动新建」的渲染层兑现，并明确激活 Tab 关闭钮常显与 chrome 对齐要求

## Impact

- `src/renderer/features/assistant/store-assistant.ts`：`closeSessionTab` / `closeSessionTabs`
- `src/renderer/styles/workspace-chrome.css`：`.agent-session-tab` / `.tab-close`
- 测试：`assistant.spec.tsx`；mock `agentSessionCloseTab` 返回 `createdSessionId`

## 商业化与体验价值

助理是高频入口；「关不掉唯一 Tab」与「关钮不像自家产品」会直接破坏成品感。本修复成本低、感知强，守住工作伙伴可信度。
