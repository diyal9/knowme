## Why

货架卡片上一侧是绿色「开始」文字按钮、一侧是图标，视觉不统一；点「开始」会弹出另一套精简确认，与点卡片本体打开的介绍弹层不一致，增加认知与误触成本。用户期望：页脚操作统一为右侧图标；「运行」与点卡片都进入同一详情，真正启动只在详情里的「开始运行」。

### 目标用户

- 主：在工作流货架上挑流程、想先弄懂再运行的人。
- 次：从卡片快速打开详情、再决定是否开始的人。

### 商业化与体验价值

统一入口降低「开始」语义歧义；详情内见 DAG 与 I/O 再启动，提升信任与启动转化，不改 package 真源。

## What Changes

- **点卡片 / 点运行图标 → 同一介绍弹层**：简介、结构化输入/产出、Agent 协作 DAG（只读），可二次「开始运行」。
- **页脚图标化并靠右**：运行用 play 图标按钮，与编辑/复制样式一致；去掉绿色「开始」文字主按钮。
- **去掉卡片「精简确认」主路径**：不再从卡片打开 `workflow-start` 弹层。

### 验收标准

- 点卡片空白区与点运行图标打开同一介绍层（含 DAG 与输入/产出）。
- 详情内可运行时「开始运行」进入确认输入；不可运行时禁用并标明缺失项。
- 运行与次要操作均为右侧图标按钮，风格一致。
- 关闭按钮 / Escape / 遮罩可回到货架。

### 非目标（Non-goals）

- 不改 workflow-package schema、不进 Studio 编辑。
- 不恢复启动路径的完整 daemon 上下文表单。
- 不在卡片本体上画 DAG。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workbench-workflow-shelf`：卡片与运行图标同开介绍层；页脚图标右对齐。

## Impact

- `src/workbench.js`：货架页脚图标；`use`/`inspect` 均打开详情。
- `src/workbench-shelf.css`：页脚 `justify-content: flex-end`。
- `tests/workbench-templates.test.js`：卡片/运行入口与图标断言。
