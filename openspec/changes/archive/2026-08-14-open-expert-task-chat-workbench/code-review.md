# Code Review

## 结论

通过。未发现阻断问题。

## 核对项

- 单专家任务不再调用 `launchAgentRun`，而是由 `workspace.js` 宿主创建持久专家 Session。
- 任务使用 `execRef.kind=session` 关联 Session；旧 `run` 引用仍走既有恢复路径。
- 任务目标仅预填 Composer，不自动发送或消费模型额度。
- `agent-session-context-update` 只接受 `knowledgeRefs`，Session DTO 不投影 Provider 密钥。
- `ai-generate` 从已加载 Session 解析 Provider；显式失效时不回退，远程范围不会混入本地知识片段。
- 知识选择同时存在于专家首屏和 Composer 工具栏，消息产生后仍可调整。
- 工作台右栏使用独立专家任务投影，没有伪装成 Workflow Run。

## 风险与覆盖

- Session 创建失败保留 draft 与弹窗输入，重试更新同一 draft。
- 删除中的 Provider 以 limited 展示；检索端过滤失效引用。
- Electron 干净用户目录冒烟覆盖创建、知识切换和同 Session 恢复。
- 全量测试、lint、OpenSpec strict validation 和 `git diff --check` 均通过。
