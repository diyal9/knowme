## 1. 基线与 API 对齐

- [x] 1.1 冻结 `surfaces.md` 对照表；从 `f6ad048` 导出 rail/工作台/助理关键截图到 `evidence/screenshots/baseline/`
- [x] 1.2 对齐 `src/shared/api.ts` 与 preload：补类型、去掉 `agentFileCatalog`、删除已退役便签桥
- [x] 1.3 文件 `@` catalog 改为 `sourcesTree` / children 加载（wiring spec）

## 2. Wave A — 壳、文件中心、FAB

- [x] 2.1 文件中心：源切换、刷新、树、搜索、空源引导与基线一致
- [x] 2.2 页内 toast、右键菜单、日志 FAB（徽章/打开日志窗）
- [x] 2.3 通用抽屉骨架（backdrop、Esc、层级）

## 3. Wave B — 工作台房间

- [x] 3.1 货架：网格切换、最近、管理入口、空/锁态、启动进入 run-input
- [x] 3.2 任务房间：启动表单、daemon 日志/HITL/产物/过程、返回/再跑
- [x] 3.3 管线：自动化列表 CRUD 弹层、daemon review 详情
- [x] 3.4 专家协作：快捷/最近/任务房对话壳
- [x] 3.5 Studio：平移、端口连线、palette、inspector 表单、按来源返回

## 4. Wave C — 助理

- [x] 4.1 Session 标签：list/new/get 持久化，右键重命名/钉住
- [x] 4.2 模型、专家、本会话知识、斜杠技能、快捷指令、附件菜单
- [x] 4.3 流式状态条、daemon process feed、图片查看器

## 5. Wave D — 专家库与次要窗

- [x] 5.1 Hub：chips、精选、详情抽屉、添加能力、自建专家
- [x] 5.2 设置飞书授权轮询/scope；记忆窗点击不打开便签
- [x] 5.3 知识网导入导出入口接到已有 IPC（若基线在设置则只补设置）

## 6. 证据与门禁

- [x] 6.1 每波截图 `evidence/screenshots/react/` 对照 baseline
- [x] 6.2 `npm test`、`lint`、`typecheck:renderer`、`test:renderer` 全绿
- [x] 6.3 写 `evidence/dev-self-test.md`

## 7. 体验缺口（制作人真机反馈后重开）

- [x] 7.1 Rail「自动化」进入独立 `mode-automation` / `#wbAutomationPage`（不再停在助理）
- [x] 7.2 管理工作流改回 dashboard（返回、维护你自己的流程、+ 新建工作流）
- [x] 7.3 助理工具栏对齐基线；顶栏 plus=我的专家，更多=新对话
- [x] 7.4 文件中心展开操作菜单：新建文件、打开源目录、折叠
- [x] 7.5 任务房间 / Studio / Hub / 设置 / 知识网按 `surfaces.md` 继续补样式与交互
  - [x] 7.5.1 **WB-run / WB-run-input**：任务房间顶栏、确认输入表单、状态/目标/产物/trace/过程日志分区（基线 `wb-run-*` class）
  - [x] 7.5.2 **WB-expert-room**：`wb-expert-task-room` 顶栏/状态/对话体/返回
  - [x] 7.5.3 **WB-shelf**：锁态改为 `div.wb-shelf-locked`（role=status）
  - [x] 7.5.4 **WB-studio**：画布节点右键删除；HeadNav/脏标记/返回来源（Wave 3 已有，本波补右键）
  - [x] 7.5.5 **H-***：精选行 icon/箭头；目录卡 head/desc/foot；详情抽屉 `hub-drawer` 视觉
  - [x] 7.5.9 **H-tabs chrome**：专家库顶栏对齐工作台下划线 Tab；隐藏重复品牌；无覆盖层关闭钮（一级 rail 面）
  - [x] 7.5.6 **K-list / K-io**：`knowledge-home-indexed` 布局、统计条、侧栏导入导出
  - [x] 7.5.7 **W-settings**：设置页副标题对齐基线（无 IPC 变更）
  - [x] 7.5.8 Run 参与专家/执行节点图、Run-input 专家预览、WB-daemon-review Tab 面、货架最近运行回看、TaskHome 管理最近、工作流删除确认

## 8. Wave 8 — 壳 overlay / Hub 弹层 / Studio 离开 / 工作区树（2026-08-15）

- [x] 8.1 **S-toast / S-ctx / S-drawer / S-fab**：基线 class（`toast-wrap`/`ctx-menu`/`drawer`/`km-fab-root`）；FAB 通知面板 + 日志/目录
- [x] 8.2 **A-empty**：快捷卡副文案对齐 f6ad048；composer 仍嵌空态中部
- [x] 8.3 **WB-studio**：节点 `#ctxMenu` 删除；离开 Studio 改 `confirm-modal`（非 `window.confirm`）
- [x] 8.4 **WB-ws / WB-modals**：`WorkspaceTreeModal`（`wb-ws-mask`）；Daemon review 顶栏「代码工作区」入口
- [x] 8.5 **H-add / H-expert-dlg**：`hub-dialog-mask` + 五 Tab 添加能力 + 自建专家 foot
- [ ] 8.6 **仍薄（未在本轮签字 1:1）**：A-tabs 右键、H-picker、Studio palette 密度、WB-search 全量、Electron 真机像素对照

## 9. Wave 9 — FAB attention / 自动化飞书 / 助理核心 / 文件降级 / 知识网 IO（2026-08-15）

- [x] 9.1 **S-fab attention**：`store-attention` + `bindAttentionEvents`（`onAttentionOpen` / `knowme-needs-attention`）；`WorkspaceFab` 通知列表/徽章/`needs-attention` 脉冲；deepLink → `openDaemonTaskSlug`
- [x] 9.2 **WB-auto-modal**：`ManageAutomationModal` 基线 `wb-auto-modal-*`；飞书个人/群推送 checkbox + datalist + `workbenchAutomationFeishuTargets` IPC；domain `automation-push.ts`
- [x] 9.3 **A-attach / A-stream / A-image / A-topic**：`AgentComposer` 真实附件；`AssistantTopicNav` 话题目录；流式条「返回工作台」；图片查看器；domain `agent-topics.ts` 对齐 f6ad048 分组
- [x] 9.4 **S-files**：点击文件 `sourcesReadFile` 预览；分屏/版本 **disabled 诚实降级**（架构已退役独立编辑器）
- [x] 9.5 **K-io**：`loadKnowledgeIo` → `fabricGraph` + `knowledgeStewardTaskList`；知识网侧栏 Fabric 统计 + Steward 任务
- [x] 9.6 门禁：`typecheck:renderer` / `test:renderer`(89) / `npm test`(1562) / `lint` 全绿；`store-workbench` 拆 helper ≤400 行
- [ ] 9.7 **仍差（诚实）**：S-files 分屏/版本非基线编辑器；Electron 真机截图未重跑

## 10. Wave 10 — 自动化全字段 / H-picker / A-tabs ctx / A-stream feed / Studio 密度（2026-08-15）

- [x] 10.1 **WB-auto-modal**：`ManageAutomationForm` 补 schedule daily/interval/once、connector select、`permissionMode`、管线 select（`workbenchLoad` + domain `automation-modal.ts`）
- [x] 10.2 **WB-studio**：`StudioPalette` 搜索+hint；`StudioInspectorFields` 按 kind 补 `wb-studio-field`（llm/condition/gate/tool/agent）
- [x] 10.3 **H-picker**：`HubPickerDialog` + `HubExpertDialog` Skills/连接器/知识源多选（`domain/hub-catalog-fields.ts`）
- [x] 10.4 **A-tabs**：`AssistantSessionTabs` 对齐 f6ad048 tab-ctx（管理/复制/Pin/分叉/关闭左中右 + 图标）
- [x] 10.5 **A-stream**：`AgentDaemonProcessFeed` 多行折叠日志（`agent-daemon-process-*` class）
- [x] 10.6 门禁：`typecheck:renderer` / `test:renderer`(90) / `npm test`(1562) / `lint` 全绿；顺带统一 `RunState.agents` 类型
- [ ] 10.7 **仍差（诚实）**：WB-auto 无 cron 表达式；A-stream 无基线 progress 子块/动画；A-tabs 新建仍在「更多」；WB-search 全量；Electron 真机像素未签字

## 11. Wave 11 — A-tabs 新建 / 助理菜单密度 / A-stream / WB-search / Studio 工作流（2026-08-15）

- [x] 11.1 **A-tabs**：保留 plus=我的专家；新增可见 `agent-new-chat-tool`（新对话）；更多菜单对齐基线（复制总结/新对话/在新对话继续/重命名/关闭）
- [x] 11.2 **A-history / A-model / A-knowledge / A-at / A-slash / A-quick**：history pop-meta；model 分组+Context Usage 壳；knowledge 跟随默认；quick 基线 class+Ctrl+K；slash/at 空态与 class
- [x] 11.3 **A-stream**：过程摘要+运行日志双区块 + 紧凑进度卡；daemon log 仍经 `onWorkbenchDaemonLogEvent`（无独立 progress IPC 到助理 col）
- [x] 11.4 **WB-search**：placeholder/显示时机对齐 f6ad048（仅 shelf surface `hidden`）
- [x] 11.5 **Studio**：inspector 补工作流 name/goal；llm 模型 select、tool/skill 下拉接 `llmModels`/`capabilityList`
- [x] 11.6 门禁：`typecheck:renderer` / `test:renderer` / `npm test` / `lint`
- [ ] 11.7 **仍差（诚实）**：Context Usage 无真实 token IPC；knowledge provider 列表非 Hub provider IPC；Studio 入出参 IO 未还原；Electron 真机像素未签字

## 14. Wave 14 — 知识网对齐 f6ad048（2026-08-16）

- [x] 14.1 顶栏 Tab：我的知识 / 待我确认 / 来源
- [x] 14.2 我的知识：单层顶栏（Tab+统计+操作）+ 左资料树 + 右阅读；空库首触欢迎
- [x] 14.3 待我确认：steward 提案接受/拒绝/稍后；来源页导入导出
- [x] 14.4 更多：检查问题、Obsidian；整理走 steward IPC（tasks+proposals）
- [x] 14.5 renderer knowledge.spec + domain tree/markdown 测试
- [x] 14.6 排版：去掉重复「我的知识」标题与顶栏「来源」按钮；嵌套目录默认折叠；树行距与徽章对比度

## 13. Wave 13 — 工作台首页折叠 / 货架更多 / 管线交付路径（2026-08-16 制作人真机）

- [x] 13.1 **WB-taskhome**：快捷专家与「你的协作」默认预览 3 条，展开后才内滚（对齐 f6ad048 `TASK_QUICK_PREVIEW` / `TASK_RECENT_PREVIEW`）
- [x] 13.2 **WB-shelf**：去掉列表/网格切换；货架默认只露一行，「更多」展开；首页锁定滚动
- [x] 13.3 **WB-run-input**：任务房间确认输入对齐基线（本次目标、执行方式、左侧不再重复长提示）
- [x] 13.4 **WB-daemon**：管线首页改回「交付路径」+ 运行列表，去掉工作模式卡
- [ ] 13.5 Electron 真机像素对照仍待制作人签字

## 12. Wave 12 — Studio IO / knowledge provider / Context Usage / 截图（2026-08-15）

- [x] 12.1 **WB-studio**：`StudioIoFields` 还原 `wb-studio-io-*` 入出参行（添加入参/出参、类型/必填/示例/枚举）
- [x] 12.2 **WB-studio**：`knowledge` 节点 inspector 接 `knowledgeProviderList` IPC 下拉（对齐 f6ad048 `studioKnowledgeOptionsHtml`）
- [x] 12.3 **A-model / A-stream**：无独立 token IPC；接现有 `ai-stream-event` 的 `contextInfo` + stage 摘要到模型菜单与过程 feed（`onAiStreamEvent` 已有 preload，非假数据）
- [x] 12.4 **证据**：Vite preview + Playwright 截图更新 `evidence/screenshots/react/`（**非** Electron 真机签字）
- [x] 12.5 门禁：`typecheck:renderer` / `test:renderer`(98) / `npm test`(1562) / `lint` 全绿
- [x] 12.6 **到此为止**：见 `surfaces.md` / 本文件「Wave 12 诚实清单」— 核心路径已尽量对齐，剩余为硬限制

## 15. Wave 15 — Studio 对齐 f6ad048 工具栏/画布手势/专家选择器（2026-08-16）

- [x] 15.1 工具栏图标：轻量/专业切换、一键对齐、保存、检查流程（不再用文字「保存工作流」）
- [x] 15.2 组件库：开始/结束点选已有节点；专家打开工作台专家选择器后入画
- [x] 15.3 画布：滚轮缩放、适应、空白平移、连线预览、Delete 删节点/边
- [x] 15.4 轻量步骤列表；inspector 专家下拉绑定工作台专家
- [x] 15.4b 无选中节点隐藏属性；专家属性补齐；检查流程 tips + 画布动画；轻量步骤含开始/结束
- [ ] 15.5 Electron 真机像素对照仍待制作人签字

## 16. Wave 16 — 自建专家编辑器对齐重构前（2026-08-16）

- [x] 16.1 还原头像单行横滑、AgenticType 分隔下拉与 ReAct/规划勾选
- [x] 16.2 Skills/连接器/知识库改回摘要 chips + 二级选择器；空目录引导安装
- [x] 16.3 必填校验、底栏已选摘要、保存写入 avatar/agentic/soul/sop/description
- [ ] 16.4 Electron 真机像素对照仍待制作人签字

