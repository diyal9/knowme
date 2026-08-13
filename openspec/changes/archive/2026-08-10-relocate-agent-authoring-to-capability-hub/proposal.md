## Why

能力界面本就已经是三层能力目录（专家 expert / 技能 skill / 连接器 connector），专家含官方(curated)来源、文案已写「添加自己的专家」，且存在「添加到工作台」的跨界流程（`capability-hub.js` 的 `requestWorkbenchAdd`）。这说明「Agent = 能力界面的专家」本就是同一实体（如 `office-partner` 既是 hub 专家、又是工作流 agentRef）。

但当前分工是反的：Agent 的**浏览/安装**在能力界面，真正的**创建/编辑/调优表单**却在工作台管理抽屉（`wbAgentManagerForm`），加上工作台顶部还新加了「我的 Agent」Tab、助理侧又有「我的专家」——同一个 Agent 概念散落四处，用户不知道去哪配、配完在哪用。

正确的分层是把这一刀切在 `Skill → Agent │ 编排 → 工作流` 的关节上：**能力（零件）归能力界面，装配与运行（成品）归工作台**。据此：Agent 的官方/自建/调优全部收敛到能力界面；工作台专注「挑工作流 → 编排 → 运行」，不再承载任何 Agent 创建/编辑/调优，顶部两 Tab 撤销、回到单一工作流货架。

### 目标用户

- **主要**：把 KnowMe 当生产力工具的知识工作者。想干活时进工作台挑流程跑；想调教工具时进能力界面配 Agent。两个心智各有唯一的家。
- **次要**：进阶用户在能力界面沉淀自己的 Agent（配 Skill/知识/Tool），在工作台把这些 Agent 编排成自己的工作流。

## What Changes

### 能力界面侧：成为 Agent 的唯一家

- **BREAKING｜Agent 的创建/编辑/调优迁入能力界面**：专家页支持官方(curated 只读、可复制)、自建、调优（配 Skill / 专属知识库范围 / Tool/连接器）。工作台原管理抽屉的智能体编辑表单能力整体迁移至此。
- **专家目录接真实数据**：移除 `MOCK_CATALOG` 充数，专家目录反映真实本地 + 官方种子 Agent。
- 安装/自建的 Agent 进入统一 Agent store，作为工作台编排的节点候选。

### 工作台侧：专注编排与运行

- **BREAKING｜撤销顶部两 Tab，回到单一工作流货架**（恢复 `rebuild-workbench-workflow-shelf` 的无 Tab 主张）。货架混排团队(official+team)与个人(personal+forked)工作流，卡片标「团队」/「我的」，保留领域筛选（默认全部）。
- **编排升为工作台一级动作**：从货架「新建工作流」进入编排，节点候选来自能力界面的 Agent store；节点检查器**只设该步骤的目标/角色**，不再配置 Agent 本身的 Skill/知识/Tool（那属于能力界面）。保存后工作流以「我的」来源即时进入货架。
- **工作台不再有任何 Agent 创建/编辑/调优入口**；相关按钮改为跳转能力界面。
- **管理抽屉缩为两面板**：执行后端(Daemon) + 自动化。

### 收敛与治理

- 助理侧「我的专家」改为**只读消费**（开始对话），不再提供 Agent 增删改。
- 本 change **取代** `add-workbench-work-mode-tabs`（两 Tab 主张）并**退役其 `workbench-work-modes` 能力**；此前设想的 `recast-workbench-workflow-and-agent-tabs` 方案废弃、不落地。

## Capabilities

### Modified Capabilities

- `capability-hub`: 升级为 Agent 创建/编辑/调优的唯一场所；专家目录去 Mock、接真实数据；安装/自建流入统一 Agent store。
- `agent-workbench`: 撤销顶部 Tab 回到单一货架；编排升为一级动作；管理抽屉缩为两面板；移除全部 Agent 编辑能力。
- `workbench-workflow-shelf`: 单一货架混排团队与个人来源并以卡片标签标注；无 Tab。
- `agent-composition-studio`: 编排节点候选取自能力界面 Agent store；节点检查器仅设步骤目标，不配置 Agent 本体。

### Removed Capabilities

- `workbench-work-modes`: 两 Tab 工作模式能力退役（工作台回到单一货架，Agent 迁至能力界面）。

## Impact

- `src/capability-hub.js`：新增 Agent 创建/编辑/调优表单；去 `MOCK_CATALOG`；接 `expert-save` / agent-profile 真实数据。
- `src/lib/capability-hub-service.js` / `expert-runtime.js` / `agent-profile-store.js`：专家=Agent 的读写与配置快照统一到一处 store。
- `src/workspace.html`：移除 `#wbModeTabs`；管理抽屉移除智能体面板；货架增「新建工作流」入口。
- `src/workbench.js`：删除 `activeWorkMode` / 两 Tab 路由 / `wbAgentManagerForm` 相关；`shelfItems()` 单一货架混排+来源标签；编排节点检查器裁剪为仅步骤目标；节点候选读 Agent store。
- `src/workspace-agent.js`：「我的专家」改只读消费。
- `src/workbench-shelf.css` / `workbench-layout.css` / `workbench-console.css`：删两 Tab、智能体面板、失效选择器；货架标签样式。
- 测试：`tests/workbench-templates.test.js`、能力 hub 相关测试、Electron 冒烟同步更新。

## 验收标准

- 进入工作台是单一工作流货架，无顶部 Tab；货架同格混排团队与个人工作流并各带「团队」/「我的」标签；领域筛选可见默认全部。
- 工作台任何位置都没有 Agent 的创建/编辑/调优入口；点相关操作跳转能力界面。
- 能力界面专家页可新建自建 Agent、可对专家「调优」配置 Skill/知识库范围/Tool；官方专家只读、可复制为自建再调优；目录无 Mock 占位。
- 在能力界面新建/安装一个 Agent 后，进入工作台编排，该 Agent 出现在节点候选库。
- 工作台编排「新建工作流」拖 Agent 连 DAG 保存后，以「我的」标签即时进入货架；编排节点检查器只设步骤目标，无 Agent 本体配置项。
- 管理抽屉只有「执行后端」「自动化」两面板。
- 助理「我的专家」与能力界面是同一份 Agent，助理侧不可增删改。
- `npm test`、`npm run lint`、`npx openspec validate relocate-agent-authoring-to-capability-hub --strict`、Electron 冒烟与体验验收通过。

## 非目标（Non-goals）

- 不改执行内核、`workflow-package` schema、运行三段式行为。
- 不重做能力界面 iframe 壳与其视觉体系，仅补齐 Agent 创建/编辑/调优与真实数据接入。
- 不引入重型自由画布；编排维持受治理的 Agent DAG 拖拽。
- 不新增工作流内容、不做市场/云端同步。
