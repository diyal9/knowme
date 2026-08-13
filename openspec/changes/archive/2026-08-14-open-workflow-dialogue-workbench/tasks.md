## 1. OpenSpec + store

- [x] 1.1 任务 store `normalizeTask` 增加 `workflowId` / `workflowName`；单测覆盖
- [x] 1.2 `beginExpertTask` 接受并持久化 workflow 字段

## 2. Entry rewire

- [x] 2.1 实现 `workflowPrimaryExpert` + `openWorkflowDialogueRoom`
- [x] 2.2 货架卡片空白 / Enter·Space / play·inspect·use → 对话房
- [x] 2.3 卡片 aria-label 改为打开工作流对话语义

## 3. Right rail

- [x] 3.1 `expertTaskRoom` 携带 `workflow`；`renderExpertTaskRoom` 投影 I/O、步骤、能力
- [x] 3.2 右栏次要「开始运行」→ `beginWorkflowRun`
- [x] 3.3 最近任务恢复时带回 workflow 投影

## 4. Conflict specs + verify

- [x] 4.1 纠正 `workflow-card-intro-vs-start` / `clarify-workflow-shelf-naming-and-detail` 入口描述
- [x] 4.2 更新 `tests/workbench-templates.test.js`；`npm test` / `npm run lint`
- [x] 4.3 写 `evidence/dev-self-test.md`；Electron 冒烟点卡片进双栏
