# Why
长周期工作流需要人工节点、动作授权、检查点与可审计介入，现有 Runner 只覆盖 Agent 和少量控制节点。

# What Changes
- 原地扩展 Team Workflow Runner 执行 Action/Human。
- 持久化 Root Run、节点 attempt、检查点、授权、血缘、偏离和审计事件。
- 增加暂停恢复、人工/Gate 提交、介入、重跑、Agent 替换和评论接口。

# Impact
不建立第二套执行器；应用重启可从持久化 Run 状态恢复。
