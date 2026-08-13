# QA Plan

## Smoke Scope

- [x] 工作台仅以工作 / 资源 / 编排三个稳定工作面为入口。
- [x] 顶栏始终显示全部 / 办公 / 研发 / 视觉领域筛选，切换后管线与页面上下文同步。
- [x] 总览显示待处理、正在运行、环境 readiness、常用管线和统一新建运行。
- [x] 管线页使用列表 + 详情面板，查看不启动，阻塞管线不可点击启动。
- [x] Agent 资源页使用列表 + 详情面板，详情仅一个 Profile Run 主操作。
- [x] 运行中心统一展示 Daemon、Local Team 与兼容本地来源。
- [x] 从 Agent 详情打开并保存 Agent Profile。
- [x] 从 Agent Profile 通过统一启动器创建 Run；聊天保持次级操作。
- [x] 从 Agent Graph 预览保存个人工作流。
- [x] 编排作为独立工作面显示 Graph、节点检查器与运行预览入口。
- [x] 官方流程在启动预览中可以复制为个人流程，源流程保持只读。
- [x] Agent Graph 运行状态、执行来源和产物引用进入共享工作上下文。
- [x] Daemon / Local Team 进入统一运行目录；legacy local 仅只读展示。
- [x] 办公会议、研发交付、视觉生成三条垂直管线均出现；依赖缺失时诚实阻断。
- [x] 窄窗口下导航、领域筛选、新建运行和主内容无页面级横向溢出。

## Behavioral Closure Scope

- [x] 顶栏、管线、Agent、Graph 和产物入口进入同一 Launch Controller。
- [x] 依赖 ready 的办公、研发、视觉管线分别创建真实统一 Run；blocked fixture 仍禁止启动。
- [x] Agent Profile 启动写入 Profile/Skill/权限快照并可从运行目录恢复。
- [x] Graph 保存为个人 Workflow Package 后可重载并产生新的 rootRunId。
- [x] Daemon 与 Local Team Run 同时出现在工作面，并保留 executionSource。
- [x] 绑定 Workflow Package 的自动化可创建统一 Run；未绑定自动化无执行动作。
- [x] Daemon 与 Agent Graph 产物均可打开，并可作为新运行的 artifactRef 输入。
- [x] 任务工作间返回后恢复领域、资源过滤和滚动上下文。
- [x] 任务工作间保持「工作」Tab 激活，并在桌面同时显示运行队列与详情。
- [x] 应用重启恢复未完成启动草稿或已创建 Run，且不重复创建。

## Dual-track UX Scope

- [x] 一级入口仅展示开始工作与搭建 Agent，旧资源/编排术语不再作为用户导航。
- [x] 开始工作页同时展示现成工作流、个人工作流和我的工作，工作流主操作统一进入 Launch Controller。
- [x] 工作流摘要使用结果导向文案；Daemon、MCP、Profile 和 Graph 只在详情或设置中渐进披露。
- [x] Agent 可通过拖拽或键盘操作加入步骤流并调整顺序。
- [x] 节点关系可设置为接着执行、同时执行或执行前确认，保存前由 Graph Runtime 校验。
- [x] 点击节点可配置职责、Skill、提示词、知识库和高级设置；Skill 使用可视化选择而非手工 ID。
- [x] 节点级 Profile 副本不会修改官方或共享 Agent；提示词与知识策略进入执行快照。
- [x] 保存后重启可恢复 Graph、节点 Profile、关系与知识设置，并可再次测试运行。
- [x] 默认窗口与 720×640 窄窗口均无页面级横向溢出；拖拽有键盘替代。

## Regression Scope

- `npm test`
- `npm run lint`
- Agent Graph Electron smoke
- 工作台模板与流程加载单测
- Workflow Package、Agent Profile、Work Context 持久化单测
- 控制台 projection、readiness、状态归一化和反模式单测
- 三领域 Electron 垂直烟测
- 工作台闭环 Electron 烟测（ready/blocked、Profile、Graph、自动化、产物与重启恢复）

## Four-page Responsibility Scope

- [x] 一级入口依次展示开始工作、工作流、智能体管理和 Daemon 模式。
- [x] 工作流候选仅包含可由本地 Agent Package Runtime 解析的 Agent，Daemon Agent 不进入 DAG。
- [x] 智能体管理可编辑所有非 Daemon 本地 Agent 的 Package 与默认 Profile，保存后工作流候选立即刷新。
- [x] 工作流节点只编辑步骤名称、目标和关系，Agent 能力配置通过智能体管理完成。
- [x] Daemon 模式展示工作模式、固定只读 Agent 阵容、依赖、授权、启动和任务监控。
- [x] Daemon Agent 不显示编辑、保存 Profile、拖入工作流或复制节点动作。
- [x] 工作流保存、重启和运行保留 Package/Profile 哈希与快照。
- [x] 默认窗口与 720×640 窄窗口下四页可用且无页面级横向溢出。

## Anti-pattern Checks

- 不把 Daemon 后端显示成唯一的流程类别。
- 不因 Skill/Agent 缺失显示可启动或成功完成。
- 不允许 Renderer 直接读写用户能力目录。
- 不允许官方 Workflow Package 被个人保存操作覆盖。
- 不在上下文或 Profile 中写入 token、secret、password 等敏感字段。
- 不把自动化“调度器开发中”伪装为可立即执行。
- 不让 unavailable 垂直管线显示可启动按钮。
- 不因切换领域而跳回总览或混入其他领域管线。
- 不把 Skill、MCP 或知识库暴露为自由连线节点。
- 不让节点设置只停留在 Renderer 内存而未进入 Profile/Graph 快照。
- 不用 Daemon catalog 覆盖本地 Agent catalog。
- 不允许 Daemon Agent 进入本地工作流或本地 Agent 保存 IPC。
