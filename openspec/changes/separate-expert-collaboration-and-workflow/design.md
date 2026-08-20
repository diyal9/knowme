# Design

专家协作继续使用 Workbench Task Store v2、Expert Task Runtime、Agent Session/Run 与版本化交付物。工作台专家详情通过现有 `expert-get` 读取只读能力，并从专家包声明生成输入输出契约；资源配置统一跳转 Agent 中心。

工作流详情读取 Workflow Package；启动必须调用 Workflow v2 Runtime，并由 Team Runner 执行 Agent 节点。Root Run 是节点、检查点、等待项、评论和偏离的事实源，Workbench Task 只保存索引与 `execRef.kind=run`。Daemon 任务继续使用独立的 Pipeline Task 投影。

Renderer 分为专家目录/详情/任务房与流程库/详情/运行房。专家房突出待补信息、交付物和验收；流程房突出 graph、Human/Gate/异常等待项和节点侧栏。普通评论不进入正式执行上下文。

旧 `execRef.kind=daemon` 记录按管线任务展示；旧少于两个专家节点的工作流只读打开，复制并修复后才可发布或运行。所有文件与 Profile 读取留在主进程，Renderer 只消费结构化 DTO。
