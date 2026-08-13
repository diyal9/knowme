# 开发自审

## 第 8 阶段复核

- 一级导航已收敛为工作 / 资源 / 编排；运行目录和任务工作间归入工作面，管线与 Agent 共用资源面。
- 所有入口经 Launch Controller 保存同一 `LaunchIntent`；新意图会清除旧 `runId/rootRunId/slug/backend`，避免跨领域继承旧运行。
- Work Context 与 Task Draft 同步持久化目标、领域、资源、输入、后端、Profile 快照、Run 引用和返回状态。
- 垂直管线在主进程按 Agent、连接器、Daemon/Team Runtime 和图像 Provider 动态计算 readiness；Launch Controller 会再次校验，不能绕过 UI 启动 blocked 管线。
- 测试 fixture readiness 仅在 `KNOWME_TEST_SEAM=1` 时可覆盖；生产 Renderer 不能伪造运行依赖。
- Agent Profile 启动保留 Profile/Skill/权限快照；Graph 保存后可重载并产生新的 `rootRunId`。
- 自动化只有绑定可执行 Workflow Package 后才显示“立即执行”，并通过统一 launch adapter 进入运行目录。
- Daemon 与 Local Team Run 保留独立 `executionSource`；legacy local 只读，不作为新运行后端。
- 产物支持打开与“用于新运行”，输入以受限 artifact ref 传递。
- 任务工作间返回前刷新统一运行投影，并恢复领域、资源筛选和滚动位置；资源筛选可显式清除。
- 工作任务页在桌面为运行队列—任务详情分栏，窄窗口安全堆叠；任务态仍保持「工作」一级 Tab 激活。
- Agent 资源改为与管线一致的 list-detail，详情内只有一个 Profile Run 主操作；配置与聊天降为次级。
- 工作台 CSS 规则已迁出 `workspace.html`，布局层与 console 覆盖层分离；补齐 focus、reduced-motion、窄窗口和取消态语义。

## 风险检查

- 主进程持久化和执行仍由受限 IPC 暴露，Renderer 不直接访问运行 Store 或能力目录。
- 完成态不重复执行 runtime readiness；启动前和保存确认阶段仍 fail-closed。
- 办公/视觉缺依赖时保持阻断；测试 seam 同时证明依赖 ready 后可创建真实 Local Team Run。

## 复核结论

- 结论：PASS。
- 证据：`evidence/workbench-closure-electron-smoke.json`（39/39）、`evidence/workbench-console-vertical-electron-smoke.json`（19/19）、1539 项自动化测试与最终门禁。

## 第 9 阶段双轨复核

- 一级导航和工作面已收敛为「开始工作 / 搭建 Agent」，技术对象仅在详情中渐进披露。
- Studio 草案逻辑抽为纯状态模块；拖拽和按钮操作共享同一增删、重排与关系编译路径。
- 节点修改创建工作流级 Profile，官方/共享 Agent 不被覆盖；Profile、Graph 和 Workflow Package 快照均保留节点配置。
- Team Runner 使用节点 `profileId` 解析提示词、Skill、知识库、连接器、权限与预算，并写入 Child Run 快照。
- 默认窗口和窄窗口 Electron 烟测覆盖保存、重启恢复与控制台错误检查。
- 结论：PASS，无 BLOCKING。

## 第 10 阶段四页职责复核

- `workbench-load` 以 `partitionAgentExperts()` 分离本地与 Daemon catalog；Renderer 分别保存 `agents` 和 `daemonAgents`。
- 智能体管理复用受限 `expertList/expertGet/expertSave` 与 Agent Profile IPC，Package 与默认 Profile 分层保存。
- `expert-save` 明确拒绝 `origin/source: daemon`，Daemon Agent 不映射到本地保存路径。
- 工作流候选只取本地可编辑 Agent；Graph 编译器对 `agentOrigin: daemon` fail-closed。
- 工作流节点保存 Package/Profile 标识、哈希和快照；节点编辑只保留步骤名称、目标和关系。
- Daemon 模式复用 overview、Launch Controller 与任务工作间，无 Agent 编辑、Profile 保存或拖入 DAG 动作。
- 默认与窄窗口 Electron smoke 覆盖四页导航、保存、快照、只读边界、重启恢复与控制台错误。
- 结论：PASS，无 BLOCKING；1544/1544 测试、lint、OpenSpec strict、Electron smoke 14/14 均通过。
