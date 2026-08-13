## Why

工作流货架点开后进入详情弹层或表单「确认输入」，与用户期望的「对话驱动工作流」不一致：无法像专家任务那样在双栏工作间里补材料、对齐目标并 review。现在把货架主入口对齐已验证的专家对话房，降低启动摩擦并统一工作台协作范式。

### 目标用户

- 从工作流货架挑选现成流程、用对话补输入并推进产出的知识工作者。
- 需要一眼看到工作流需要什么、产出什么、绑定哪些能力的专业用户。

### 商业化与体验价值

货架是工作台主转化入口；对话房让「选流程 → 理解 → 协作」连续完成，提升工作流使用率，并与专家任务共用 Session 基建，降低后续能力包/知识库商业化的入口割裂。

## What Changes

- 货架卡片空白、键盘 Enter/Space、页脚 play **均**进入双栏工作流对话房（左对话、右工作流信息与属性），不再打开居中详情或表单确认输入作为主路径。
- 对话对象取 package 起点/首个专家，复用既有 `beginExpertTask` / Session；任务记录关联 `workflowId`。
- 右栏投影工作流短名、简介、需要/产出、协作步骤、可运行性、连接器/技能/知识；次要动作可进入既有「开始运行」跑批。
- 多专家包 v1 仍与起点专家对话，右栏列出全步骤；不新建 Orchestrator 聊天。
- Composer 可预填目标草稿，不自动发送。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workbench-workflow-shelf`: 货架主入口改为打开工作流对话房，而非详情弹层或确认输入表单。
- `workspace`: 工作台 task-room 支持工作流导向的对话工作间投影与恢复。

## Impact

- Renderer：`src/workbench.js`、相关 CSS、`workspace.html`（如需右栏块）。
- 任务存储：`src/lib/workbench-task-store.js` 增加 `workflowId` / `workflowName`。
- 复用：`beginExpertTask`、`onExpertTaskStart`、专家 task-room 布局。
- 冲突变更：纠正 `workflow-card-intro-vs-start`、`clarify-workflow-shelf-naming-and-detail` 的入口语义。
- 测试：`tests/workbench-templates.test.js`、任务 store 相关断言。

### 验收标准

- 点货架卡片或 play → 直接进入左右双栏；左为起点专家对话，右为工作流信息与属性。
- 不出现详情弹层或「填写本次信息」作为主入口。
- 右栏可见需要/产出、步骤、能力；可从右栏次要「开始运行」进入既有跑批。
- 最近任务可恢复同一 Session；失败不误报已开始。
- 自动化测试与 lint 通过；Electron 冒烟无新增控制台错误。

### 非目标（Non-goals）

- 不重做 Agent Graph Studio 或 Daemon 审阅壳。
- 不自动发送首条消息、不伪造 Run 进度冒充对话。
- 不新建多专家 Orchestrator 聊天。
- 不删除既有 run 三段壳（仅降为次要入口）。
