## 1. Card footer + click path

- [x] 1.1 卡片空白区 / Enter·Space → `openWorkflowDetail`（`kind: workflow-detail`）
- [x] 1.2 「运行」图标 → `openWorkflowAsTask` / `beginWorkflowRun`；不再从卡片打开 `workflow-start`
- [x] 1.3 绿色「开始」改为 play 图标按钮；页脚右对齐，与编辑/复制同风格
- [x] 1.4 纠偏：卡片空白不得再直达确认输入（恢复详情优先）

## 2. Intro content (DAG + I/O)

- [x] 2.1 介绍层渲染：简介、输入列表、产出列表、可运行性
- [x] 2.2 `renderShelfPackageDagHtml`：从 package graph / agentRefs 画只读 DAG
- [x] 2.3 详情「开始运行」进入既有 `beginWorkflowRun` 输入阶段

## 3. Verify

- [x] 3.1 更新 `tests/workbench-templates.test.js` 断言运行图标与同开详情
- [x] 3.2 `tests/workbench-templates.test.js` + `npm run lint`；更新 `evidence/dev-self-test.md`
