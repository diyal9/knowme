# Design
Task Store 是目标、状态、所有权和验收的事实源；Agent Session 保存沟通，Agent Run/Artifact 保存正文和证据。主进程在确认委托后创建任务、冻结 Agent 快照并启动执行，失败保留记录。新建入口要求目标与材料，输出契约生成交付项；任务房逐项接受或退回。

旧 schedule 字段由 v2 reader 保留为 `legacySchedule`，新 writer 强制关闭。直接任务提示词和运行时禁止跨 Agent 委派。
