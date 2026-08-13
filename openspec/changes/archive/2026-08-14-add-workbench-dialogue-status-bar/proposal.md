## Why

专家协作、工作流对话房与 Daemon 运行审阅进入 task-room 后，左侧对话列隐藏了 `agent-col-head`，右侧仅有极简状态点或分散的「返回」，用户无法像参考布局（项目顶栏：标题 + 操作按钮）一样一眼知道「在跟谁/哪条流程协作」以及如何退出。需要统一对话工作间顶栏，降低迷失与返回摩擦。

### 目标用户

- 在工作台用专家协作、工作流对话或 Daemon 审阅推进任务的知识工作者。
- 需要在双栏工作间内快速辨识任务身份并退回货架/列表的日常用户。

### 商业化与体验价值

对话房是工作台主转化路径；顶栏身份与操作对齐业界「项目状态栏」心智，减少「我在哪 / 怎么回去」的认知税，提升协作完成率与专业感，同时保持 KnowMe 轻量、克制的桌面体验。

## What Changes

- 在 task-room（专家协作 / 工作流对话 / Daemon 运行审阅）为**左侧对话列**增加贴顶状态栏：左侧标题（任务名 / 工作流短名 / Daemon 阶段身份），右侧上下文操作（至少「返回」；Daemon 可保留刷新等已有动作入口，不新增无关按钮）。
- **右侧任务房 / 运行面**顶栏与左侧同一视觉语言：标题区 + 状态/结论 + 操作区；专家任务房从「仅状态点」升级为完整状态栏；Daemon/工作流运行沿用并收紧 `#wbRunBack` 顶栏，避免双返回冲突。
- 空态文案「当前工作」不再承担顶栏身份职责；身份以状态栏标题为准，空态可保留引导内容。
- 总览货架/专家首页不新增此栏；助理独立模式顶栏行为不变。

## Capabilities

### New Capabilities

- `workbench-dialogue-chrome`：工作台对话工作间（task-room）统一顶栏身份与操作契约。

### Modified Capabilities

- `workspace`：task-room 布局下对话列与右栏顶栏可见性、标题投影与返回控件要求。
- `workbench-workflow-shelf`：工作流对话房 / 运行面顶栏与对话列状态栏对齐（标题 + 返回），不回退到详情弹层主路径。

## Impact

- Renderer：`src/workspace.html`、`src/workbench.js`、`src/workspace-agent.js`（标题投影）、`src/workbench-layout.css` / `src/workbench-shelf.css`。
- 测试：`tests/workbench-templates.test.js` 等静态契约。
- 不改 Daemon API、Session 协议、跑批状态机；不引入图二次级 Tab（动态/计划）与操作条（本期非目标）。

## 验收标准

- 进入专家协作对话房：左栏顶有任务/专家相关标题，右有返回；右栏顶栏同构。
- 进入工作流对话房：左栏顶显示工作流短名（或任务目标），可返回货架。
- 进入 Daemon 运行审阅：左栏或统一对话 chrome 显示 Daemon 阶段身份标题；右栏 `#wbRunBack` 仍可用且不与全局头双重返回冲突。
- 窄窗下顶栏不横向溢出；`npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不复制图二完整「动态 / 计划 / 任务 / 资产」次级 Tab 与「发布留言」操作条。
- 不重做助理模式 Session Tab 体系，不改 Rail 导航。
- 不新增邀请成员、项目权限等协作社交能力。
- 不改 Run / Daemon IPC 与产物审阅业务逻辑。
