## Smoke Scope

- [ ] 工作台首页输入目标后，进入本地 Agent Graph 确认弹窗。
- [ ] 确认弹窗显示 Agent 节点、审批节点和交接关系；无效 Graph 不可启动。
- [ ] 确认后创建 Root Run，任务区能显示本地 Team Runtime、节点状态和 gate 操作。
- [ ] 取消、失败和刷新后恢复均显示真实状态；Daemon 模板仍走原有路径。

## Regression Scope

- `npm test`
- `npm run lint`
- `openspec validate workbench-agent-graph-runtime --strict`
- KnowMe Electron 启动无未捕获主进程错误。

## Anti-pattern Checks

- 不把本地 Agent Graph 渲染成 Daemon Task。
- 不允许未确认 Graph 创建 Run。
- 不允许未知 Agent、环、悬空边或未闭合 handoff 执行。
- 不把失败、取消或等待状态显示为“已完成”。
