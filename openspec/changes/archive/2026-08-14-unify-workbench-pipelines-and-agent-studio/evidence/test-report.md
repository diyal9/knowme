# 测试报告

## 门禁

- [硬] `npm test`：PASS，1539/1539
- `npm run lint`：PASS，`lint ok`、`script-scope ok`
- `openspec validate unify-workbench-pipelines-and-agent-studio --strict`：PASS
- OpenSpec 主规格同步：PASS（8 个 capability）
- [软] qa-plan Smoke Scope：已执行
- [软] code-review：PASS
- 三领域 Console Electron smoke：PASS（19/19，控制台错误 0）
- 工作台闭环 Electron smoke：PASS（39/39，控制台错误 0）
- 双轨工作台 Electron smoke：PASS（9/9，控制台错误 0；1360×860 与 720×640）
- Harness Story 完成门禁：PASS；输出中的 advisory 均来自其他活跃 change

## 闭环结果

- PASS：一级导航仅保留工作 / 资源 / 编排，顶栏、管线、Agent、Graph、自动化与产物复用共用 Launch Controller。
- PASS：办公、研发、视觉在 ready fixture 下均创建真实 Run；blocked fixture 保持禁用与可修复提示。
- PASS：Agent Profile 启动保存 Profile/Skill/权限快照；聊天保持次级操作。
- PASS：Graph 保存为个人 Workflow Package，重载后再次运行产生不同 `rootRunId`。
- PASS：Daemon 与 Local Team Run 进入同一运行目录并保留 `executionSource`；legacy local 仅只读。
- PASS：绑定 Workflow Package 的自动化产生统一 Run，未绑定自动化无执行操作。
- PASS：Daemon 产物可打开，并以受限 artifact ref 进入新运行输入。
- PASS：应用重启恢复 Run/草稿且不重复创建；任务工作间返回恢复领域、资源筛选和 360px 滚动位置。
- PASS：任务工作间保持「工作」Tab 激活，并同时呈现运行队列与任务详情。
- PASS：Agent 资源采用 list-detail，详情仅一个 Profile Run 主操作，配置与聊天为次级。
- PASS：760px 窄窗口导航、完整四领域筛选、新建运行可用且无页面级横向溢出。

## 反模式发现

- [已修复] 领域切换后管线列表曾保留旧领域数据；改为 Renderer 内部显式领域归类并新增 Electron 断言。
- [已修复] 自动化“立即执行”曾写入虚假 queued；未绑定 Workflow Package 时现在隐藏操作，Store 返回 `scheduler_unavailable`。
- [已修复] 新启动意图曾继承上一 Run 的后端与标识；核心意图改变后现清除旧引用。
- [已修复] 任务工作间返回只恢复列表可见性；现持久化并恢复领域、资源筛选与滚动位置。
- [已修复] 新完成 Daemon Run 曾需重启后才进入运行目录；返回列表前现刷新统一投影。
- [ADVISORY] 真实外部 Provider 的远程耗时、配额和供应商错误由对应能力 Story 继续验证。
- [ADVISORY] 用户主动取消 Run 尚未进入本 smoke；取消态已有模型、UI 与单测语义覆盖。
- [已收口] 旧的 goal-first UX change 已归档，未将冲突规格同步回主规格。

## 结论

- [x] 通过，可进入 Story 门禁
- [ ] 打回开发

证据：
- `evidence/workbench-closure-electron-smoke.json`
- `evidence/workbench-console-vertical-electron-smoke.json`
- `evidence/screenshots/closure-desktop.png`
- `evidence/screenshots/closure-task-room-daemon.png`
- `evidence/screenshots/closure-agent-resources.png`
- `evidence/screenshots/closure-drawer.png`
- `evidence/screenshots/closure-narrow.png`
- `evidence/screenshots/workbench-console-desktop.png`
- `evidence/screenshots/workbench-resources-desktop.png`
- `evidence/screenshots/workbench-studio-desktop.png`
- `evidence/screenshots/workbench-console-narrow.png`

## 2026-08-09 最终 QA

- 功能 QA：PASS。
- BLOCKING：0。
- 制作人体验验收：PASS。
- 测试角色正式 QA：PASS。

## 第 9 阶段双轨复验

- PASS：一级入口仅保留「开始工作 / 搭建 Agent」，现成工作流、个人工作流与我的工作收敛到同一工作面。
- PASS：Agent 可拖入、点击添加、重排、复制和删除，三种关系经 Graph Runtime 编译为合法 DAG。
- PASS：节点职责、Skill、提示词、知识库与高级设置写入工作流级 Profile，运行快照包含提示词和知识策略。
- PASS：保存后重启可恢复 Workflow Package、节点 Profile 与关系；测试运行继续复用统一 Launch Controller。
- PASS：默认窗口与 720×640 窄窗口无页面级横向溢出，控制台错误 0。
- 证据：`evidence/workbench-dual-track-electron-smoke.json`、`evidence/screenshots/dual-track-start-work-desktop.png`、`evidence/screenshots/dual-track-build-agent-desktop.png`、`evidence/screenshots/dual-track-build-agent-narrow.png`。

## 第 10 阶段四页职责 QA

- PASS：一级入口为「开始工作 / 工作流 / 智能体管理 / Daemon 模式」。
- PASS：`workbench-load` 分别返回本地 Agent 与 `daemonAgents`；Daemon catalog 不再覆盖本地 catalog。
- PASS：智能体管理保存本地 Agent Package 与默认 Profile，保存后立即刷新工作流候选。
- PASS：工作流只接受 `origin: local` 节点；Renderer 过滤与 Graph Runtime `daemon_agent_readonly` 双重阻断。
- PASS：工作流节点保存 `agentOrigin/packageHash/profileId/profileHash`，应用重启后快照不漂移。
- PASS：Daemon 模式展示工作模式、固定只读 Agent 阵容、启动入口和任务监控；页面内无编辑控件。
- PASS：Daemon 来源通过 `expert-save` IPC 明确拒绝本地保存。
- PASS：1360×860 与 720×640 四页无页面级横向溢出，控制台错误 0。
- 自动化：`npm test` 1544/1544；lint PASS；OpenSpec strict PASS；Electron smoke 14/14。
- 制作人体验验收：PASS；测试角色正式 QA：PASS；BLOCKING：0。
- 证据：`evidence/workbench-four-pages-electron-smoke.json` 与 `evidence/screenshots/four-pages-*.png`。
