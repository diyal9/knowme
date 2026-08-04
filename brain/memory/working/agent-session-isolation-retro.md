# Story Retro：agent-session-isolation

- 完成 Agent/Session 分层，主进程持久化使上下文隔离边界清晰。
- 历史压缩采用“字符预算 + 保留近期消息 + 本地摘要”，即使摘要策略后续升级仍有确定性兜底。
- 视觉层移除重复角色文字，Agent 名称使用图标增强识别。
- 经验：qa-plan 的 Smoke Scope 需要使用可勾选条目，才能被 harness 自动识别。
