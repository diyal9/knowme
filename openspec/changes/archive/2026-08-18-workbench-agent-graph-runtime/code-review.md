## 开发自审

- Graph 编译和校验是纯函数，未把文件系统或模型调用放入 Renderer。
- 本地 Team Run 只能从主进程受限 IPC 启动，执行前重新解析并校验 Agent Package。
- Daemon 与本地 Agent Graph 保持独立状态来源和恢复语义。
- Graph 快照、Root Run ID 和终态投影均保留；失败、取消、gate 等状态没有降级为成功。
- 未修改 AgentRunExecutor 的模型循环；现有旧工作流路径继续保留。

## 待测试角色复核

制作人验收和测试角色正式 QA 仍需按 `qa-plan.md` 完成真实桌面交互走查。
