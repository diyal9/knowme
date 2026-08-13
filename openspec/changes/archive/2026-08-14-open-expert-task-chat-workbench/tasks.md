## 1. Session 与知识范围

- [x] 1.1 扩展 `agent-sessions` 与 `workbench-task-store`，规范化并持久化 taskRef、knowledgeRefs 和 session execRef
- [x] 1.2 扩展 `agent-session-new` 与 Session DTO，返回脱敏的专家能力和知识库选择投影
- [x] 1.3 增加受限 `agent-session-context-update` IPC/preload 桥，支持会话级知识库更新
- [x] 1.4 让 `ai-generate` 从权威 Session 读取知识范围，严格过滤 Provider 并安全处理全部失效

## 2. 工作台到对话交接

- [x] 2.1 在任务创建弹窗展示知识库多选，并保留专家、目标、知识选择的失败恢复状态
- [x] 2.2 增加 Workbench 宿主回调，创建任务后复用 `WorkspaceAgent.startExpertChat` 创建持久专家 Session
- [x] 2.3 创建成功后写入 session execRef、展开 task-room，并把目标预填到专家 Composer 而不自动发送
- [x] 2.4 最近任务对 session execRef 恢复同一 Session，旧 run/daemon 任务保持兼容
- [x] 2.5 工作台 surface / 详情叠层点「开始对话」走 startExpertTaskDirect，铺开 task-room 而非助理

## 3. 专家对话与任务详情

- [x] 3.1 专家空态主栏与助手一致（引导 / Composer / 快捷任务）；属性与能力迁到对话右侧
- [x] 3.2 在专家对话中提供会话级知识库选择，并覆盖 loading、empty、limited 和失败恢复
- [x] 3.3 为右侧增加非 Run 的专家任务详情投影，展示目标、身份、属性、技能连接器与知识范围
- [x] 3.4 补齐 task-room、弹窗与知识库选择的响应式、键盘焦点和 reduced-motion 样式

## 4. 验证与证据

- [x] 4.1 更新 Session/store/检索单元测试，覆盖知识范围持久化、默认回退与严格失效
- [x] 4.2 更新工作台和专家对话测试，覆盖直接交接、草稿预填、恢复同一 Session 与失败不丢输入
- [x] 4.3 运行 `npm test`、`npm run lint` 与 OpenSpec 严格校验
- [x] 4.4 执行 Electron 真机冒烟并记录 `evidence/dev-self-test.md` 与截图
