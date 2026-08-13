# 制作人 / 测试验收记录

## 当前状态

- 自动化开发自测：通过。
- OpenSpec strict：通过。
- 三领域 Console Electron 烟测：通过（19/19）。
- 工作台闭环 Electron 烟测：通过（39/39）。
- 第 8 阶段制作人 C 端体验验收：历史 PASS，仅证明技术闭环。
- 第 9 阶段双轨体验复核：PASS。
- 第 10 阶段四页职责复核：PASS。
- 测试角色正式 QA：第 8、9、10 阶段均 PASS。

## 生产级控制台核心路径

1. 用户进入工作台后立即看到工作、资源、编排三个工作面与显式领域筛选。
2. 工作面集中呈现待处理、正在运行、readiness、最近产物和唯一新建运行入口。
3. 管线页选择资源后展示输入、输出、Agent、门禁、版本、后端与唯一主操作。
4. 办公会议、研发交付、视觉生成垂直管线均可发现；测试环境缺少依赖时明确显示“暂不可运行”。
5. Agent 详情可配置 Profile，并通过统一启动器创建带快照的 Run；聊天为次级操作。
6. Graph 编排提升为独立工作面，保留节点检查器、校验详情和运行预览入口。
7. Daemon、Local Team Runtime 与兼容本地路径进入统一运行中心且来源显式。
8. 自动化未绑定真实 Workflow Package 时不显示“立即执行”，不会制造排队假象。

## 制作人走查

- [x] 10 秒内可识别当前运行、待处理事项、环境阻塞和新建运行入口。
- [x] 已知管线可在“管线 → 选择 → 新建运行”三次操作内到达启动确认。
- [x] 空态与阻塞态均有真实下一步，不显示占位成功。
- [x] 失败、取消、等待和成功在 projection 与 UI 中保持不同语义。
- [x] 默认窗口和 760px 窄窗口均无页面级横向溢出。
- [x] 控制台样式使用紧凑列表/分栏、轻圆角和扁平表面，不再依赖大 Hero 卡片墙。

## 验收结论

- [x] 通过
- [ ] 部分完成
- 复核日期：2026-08-10
- 证据：`evidence/workbench-dual-track-electron-smoke.json`、`evidence/screenshots/dual-track-start-work-desktop.png`、`evidence/screenshots/dual-track-build-agent-desktop.png`、`evidence/screenshots/dual-track-build-agent-narrow.png`

## 第 8 阶段通过条件

- [x] 一级导航仅保留工作 / 资源 / 编排，任一页不存在第二套启动器或运行目录。
- [x] 所有启动入口进入同一状态机并产生稳定 Run 标识，失败时保留可修复草稿。
- [x] 办公、研发、视觉在依赖 ready 时均可创建真实 Run，blocked 时给出一致修复动作。
- [x] Agent Profile 启动保存快照；聊天与 Run 语义明确分离。
- [x] Graph 可保存、运行、重载后再跑；其产物可打开并复用。
- [x] 自动化绑定 Workflow Package 后产生统一 Run，未绑定时无执行按钮。
- [x] 任务工作间返回工作列表后领域、筛选、资源和滚动上下文不丢失。
- [x] 工作任务页采用队列—详情结构，任务间打开时「工作」Tab 保持激活。
- [x] 管线与 Agent 资源均采用列表—详情结构，每个详情仅一个主操作。

## 第 9 阶段制作人复核问题

- [x] 用户在 10 秒内能理解「直接使用现成工作流」和「搭建自己的 Agent」两条路径。
- [x] 开始工作页不要求用户理解 Workflow Package、Profile、Graph、Daemon 或 readiness。
- [x] 用户能在三步内完成「选择工作流 → 补充材料 → 开始工作」。
- [x] 用户能拖入 Agent、调整顺序并通过点击节点配置 Skill、提示词和知识库。
- [x] 节点配置在保存、重启和测试运行后仍然生效，不只是 UI 展示。
- [x] 默认窗口与窄窗口下画布、Agent 列表和节点设置均可操作且无页面级溢出。

第 9 阶段已完成制作人体验复核，当前双轨工作台达到产品体验闭环条件。

## 第 10 阶段制作人复核问题

- [x] 用户能区分“编辑工作流”“调教本地 Agent”和“运行 Daemon 固定模式”。
- [x] 工作流只显示本地 Agent 候选，Daemon Agent 不可拖入 DAG。
- [x] 智能体管理可保存本地 Agent Package 与默认 Profile，并立即进入工作流候选。
- [x] Daemon 模式展示固定只读 Agent 阵容，无任何编辑或保存 Profile 入口。
- [x] 工作流节点在 Agent 更新后保持历史快照，并可显式识别版本。
- [x] 默认窗口和窄窗口下四个页面均可操作且无页面级横向溢出。

第 10 阶段已完成制作人 C 端体验复核与测试角色正式 QA，四页职责重构达到产品体验闭环条件。

证据：`evidence/workbench-four-pages-electron-smoke.json`、`evidence/screenshots/four-pages-agent-manager-desktop.png`、`evidence/screenshots/four-pages-workflow-desktop.png`、`evidence/screenshots/four-pages-daemon-desktop.png`、`evidence/screenshots/four-pages-home-narrow.png`。
