## Context

- 曾拆分卡片介绍（`workflow-detail`）与「开始」精简确认（`workflow-start`）。
- 用户反馈：绿色「开始」与编辑/复制图标不一致；点「开始」另开精简层与点卡片不同，增加摩擦。
- 后又误将卡片空白改为直达确认输入；产品指正：点开工作流应先出详情。
- 详情内已有「开始运行」→ `beginWorkflowRun` 进入确认输入。

## Goals / Non-Goals

**Goals**

1. 卡片空白区 / Enter·Space → 居中详情介绍（I/O + Agent DAG）。
2. 页脚图标化、右对齐；运行 = play 图标，可直达确认输入。
3. 真正启动：详情「开始运行」或页脚 play「开始任务」。

**Non-Goals**

- 可编辑 DAG、启动弹窗侧栏展开、Daemon 专用字段表单。
- 强制删除 `openWorkflowStartConfirm` 死代码（可保留但卡片主路径不再调用）。

## Decisions

1. **卡片空白 → 详情**：`openWorkflowDetail`；与 `clarify-workflow-shelf-naming-and-detail` 一致。
2. **play → 开跑**：`openWorkflowAsTask` → `beginWorkflowRun`；不再打开 `workflow-start`。
3. **页脚布局**：`footer { justify-content: flex-end }`；运行 + 编辑/复制均为 `.wb-shelf-icon-btn`。
4. **启动**：详情 `btnModalConfirm` → `beginWorkflowRun`（既有）。
5. **DAG 数据源**优先 `item.graph`；空图则 `agentRefs` 线性步骤；仍无则 degraded 文案（`renderShelfPackageDagHtml`）。

## Risks / Trade-offs

- 熟练用户从卡片开跑多一步（详情 → 开始运行）；可用页脚 play 直达。
- 不可运行工作流仍可打开详情查看缺失项；play 则 toast 提示缺失项。

## Migration

无数据迁移。
