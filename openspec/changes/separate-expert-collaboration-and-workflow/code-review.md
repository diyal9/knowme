# Code Review

通过自动化覆盖范围内的实现审查。普通工作流启动使用 Workflow v2 快照记录与本地 Agent Graph 执行，Renderer 工作流路径不再调用 Daemon 遥测或 Gate API；管线任务继续沿用原有 Daemon 路径。工作流启动启用产品边界校验，旧包和草稿读取保持兼容。

专家任务继续使用 Workbench Task Store 与 Expert Task Runtime，新增的专家成果交接只生成个人工作流草稿，不会静默启动多 Agent 执行。草稿保留任务来源、成果摘要和 I/O 契约，发布前仍需补齐至少两个专家与交接关系。

已知后续项：Workflow v2 持久化记录与 Agent Graph 的终态同步仍应在后续运行时统一，当前运行界面以 Agent Graph 树作为执行状态事实源。
