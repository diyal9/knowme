# 设计

统一投影：pending（待开始）→ executing（执行中）↔ waiting（等待中）→ ended（已结束）。结束结果是 completed / incomplete / cancelled；等待原因包括 review / approval / input / recovery。

为兼容现有运行器、恢复逻辑和任务列表，保留 draft / starting / running / revising / needs_input / review / completed / failed / cancelled 内部状态，由 shared/expert-task-lifecycle 统一投影。工作流状态不改变。

新委托 brief.completionPolicy 默认 automatic；用户在开始前可以选择 review。普通成果交付前保留执行契约、工具证据、成果类型和质量检查；所有必需交付完成且没有排队中的补充后才结束。自动交付的 acceptanceStatus 为 not_required，不能冒充用户 accepted。

旧记录没有 completionPolicy，保持原验收与恢复语义，不自动接受旧成果。新委托结束后不允许通过补充、重新确认计划、取消或成果审阅把原记录改写为执行中。失败/取消后的显式重试建立 taskRef 关联的新委托。已结束页面的普通输入仍是只讨论、不执行工具；开始后续委托按钮创建独立记录。
