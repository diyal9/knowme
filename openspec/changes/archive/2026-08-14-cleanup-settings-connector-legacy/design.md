## Context

设置 renderer 当前同时承担连接配置和飞书草稿审批：打开连接器页时会读取全部 connector drafts，并通过一个已标记 deprecated 的 IPC 代理执行审批。与此同时，Agent renderer 已使用统一 `tool-approve-draft` IPC 在执行时间线中渲染审批卡。内置 `mcp-default` 还会被默认连接器加载逻辑注入，并被设置页通用列表再次渲染，和专用“公司 MCP”配置区重复。

## Goals / Non-Goals

**Goals:**

- 让设置 renderer 只负责连接配置与状态展示。
- 保持 Agent renderer → preload → main 的统一草稿审批链路不变。
- 删除设置页旧入口对应的 renderer API 和 main IPC 代理。
- 隐藏设置页通用列表中的内置 MCP 占位项，同时继续用该内部 ID 读写专用配置。

**Non-Goals:**

- 不迁移或删除用户草稿文件。
- 不改变 MCP Host、连接器存储格式或 Agent 工具投影。
- 不删除工作台 draft inbox 所需的 `tool-drafts-list` 与 `tool-approve-draft`。

## Decisions

### 1. 删除设置页审批链路，而不是仅隐藏 DOM

移除设置页草稿区、刷新函数、事件监听、preload 暴露和废弃 main IPC handler，避免隐藏 UI 后仍保留可调用的冗余攻击面与维护成本。

备选方案是仅用 CSS 隐藏，但会留下无使用者 IPC 和重复逻辑，因此不采用。

### 2. 统一审批链路以 Agent 工具 IPC 为唯一实现

保留 `tool-drafts-list`、`tool-approve-draft`、`tool-rollback-draft` 及现有 CAS 草稿状态机。Agent 对话审批卡继续通过 preload 调用统一 IPC，主进程仍是唯一执行外部写入的位置；renderer 不直接接触飞书写 API。

### 3. 只在设置 renderer 过滤 `mcp-default`

`mcp-default` 仍是存储和 MCP 运行时使用的稳定内部 ID。设置页用它为专用公司 MCP 表单加载、保存配置，但通用连接器列表同时过滤 `feishu` 与 `mcp-default`。不修改连接器 API 返回值，以免影响 Hub、Host 或迁移逻辑。

### 4. 使用静态回归测试锁定废弃面

测试检查设置页不再包含草稿审批 DOM/函数/监听，preload 与 main 不再包含旧 IPC，并确认通用列表过滤内置 MCP。该变更不新增依赖，不增加启动 I/O 或常驻内存。

## Risks / Trade-offs

- [用户无法从设置页处理历史草稿] → 草稿数据不删除，仍可由工作台 draft inbox 或原 Agent 执行上下文处理。
- [误删统一审批能力] → 测试明确保留 `toolApproveDraft` 与 Agent 审批卡标识。
- [过滤内部 MCP 后无法配置] → 专用配置区仍按 `mcp-default` 查找、加载并保存。

## Migration Plan

1. 发布代码清理，不改用户数据格式。
2. 已有草稿和连接器配置原地保留。
3. 如需回滚，仅恢复设置 renderer 与旧 IPC 代理；无需数据回滚。
