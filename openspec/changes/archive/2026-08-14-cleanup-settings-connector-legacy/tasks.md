## 1. 设置页职责清理

- [x] 1.1 移除设置页飞书待审批草稿 DOM、刷新逻辑与批准/拒绝事件处理
- [x] 1.2 设置页通用连接器列表过滤内置 `mcp-default`，专用公司 MCP 表单继续正常加载与保存

## 2. IPC 与兼容代码清理

- [x] 2.1 从 preload 删除设置页专用草稿列表与废弃审批代理
- [x] 2.2 从主进程删除 `connectors-drafts` 与 `connectors-approve-draft` 废弃 handler，保留统一 tool draft IPC

## 3. 回归验证

- [x] 3.1 增加设置页和 IPC 静态回归测试，覆盖废弃入口消失及 Agent 统一审批链路保留
- [x] 3.2 运行 OpenSpec 校验、测试与 lint，并记录开发自测证据
