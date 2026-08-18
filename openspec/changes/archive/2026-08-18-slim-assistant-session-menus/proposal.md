## Why

助理 Tab 右键与右上角 ⋯ 是按浏览器/IDE 页签套的：管理对话只是打开另一份菜单，Pin / 分叉 / 关闭左中右、动作表现对知识工作台没有意义。用户面对的是工作伙伴会话，不是一排浏览器页签。

## What Changes

- Tab 右键只保留本条会话动作：重命名、复制对话记录、关闭
- ⋯ 只保留当前工作动作：新对话、在新对话继续、复制当前总结；有错误时才出现复制错误信息
- 去掉：管理对话、Pin、分叉、关闭左侧/右侧/其他、动作表现、⋯ 里的重命名与关闭 Tab（与 Tab `×` / 右键重复）

## 目标用户

在助理里开几条工作对话的知识工作者，需要少而准的菜单，而不是页签管理器。

## 验收标准

- 右键看不到 Pin、分叉、关闭左/右/其他、管理对话
- ⋯ 看不到动作表现、重命名、关闭 Tab；无错误时看不到复制错误信息
- `+` 仍是选专家；空白新对话仍在 ⋯「新对话」
- 相关 renderer 测试通过

## 非目标（Non-goals）

- 不改历史弹出、Tab `×`、专家 `+`
- 不删除主进程 Pin / fork IPC（仅收起入口）
- 不把新对话提升到顶栏图标

## Capabilities

### Modified Capabilities

- `agent-session-tabs`：右键与 ⋯ 按工作伙伴会话收敛，不再要求浏览器式页签管理项

## Impact

- `AssistantTabContextMenu.tsx`、`AssistantSessionTabs.tsx`
- `openspec/specs/agent-session-tabs/spec.md`（delta）
- `assistant.spec.tsx`
