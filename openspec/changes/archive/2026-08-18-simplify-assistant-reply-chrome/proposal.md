## Why

助理回复过程把同一状态套了三层（白卡片、「执行进度」、内部灰条、底下再一条「正在整理…」），观感碎。气泡下的「应用到文件 / 插入光标 / 追加文末 / 替换全文」是 Sticky Notes 编辑器语义；独立笔记已退役，insert 实际也只是追加文末。知识工作台写文件应走产物卡确认，而不是便签式套用。

## What Changes

- 过程态收成一条进度（当前活动 + 耗时）；单步不展开、不再叠 thinking 胶囊
- 去掉气泡「应用到文件」菜单及插入/追加/替换
- 保留 `editor_patch` 产物卡接受/拒绝写入内容源

## 目标用户

在助理里看过程、把结果落到工作文件的人，不要便签编辑器动作。

## 验收标准

- 生成中只见一条「正在整理相关内容 · 3.5s」类进度，无重复胶囊
- 完成后的助手气泡看不到「应用到文件 / 插入光标 / 追加文末」
- 产物卡接受仍可写入目标文件
- 相关 renderer / domain 测试通过

## 非目标（Non-goals）

- 不改飞书妙记等正文卡片的内容结构
- 不删主进程 artifact IPC
- 不重做整条 Markdown 主题

## Capabilities

### Modified Capabilities

- `agent-chat-ux`：过程 chrome 单行化；气泡不再提供应用到文件
- `assistant-apply-artifacts`：写文件只走产物卡

## Impact

- `AgentMessageBubble.tsx`、`AgentExecutionTimeline.tsx`、`agent-chrome.css`
- 删除 `AgentChatApplyActions.tsx`；`store-assistant-apply.ts` 去掉 insert/append 入口
- `assistant.spec.tsx`、`agent-execution-timeline.spec.ts`
