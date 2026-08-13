## 1. Official catalog module

- [x] 1.1 新增 `src/lib/official-workflows.js`：三条官方 Package（会议闭环 / 三角色交付 / Brief 审阅）含 members、nodes、edges、gates、inputs/outputs、qualityGates
- [x] 1.2 导出 `listOfficialWorkflowPackages()` 与 `requiredExpertIds()`
- [x] 1.3 单测覆盖结构约束（≥2 agents、≥1 gate、source=official）

## 2. Experts & catalog

- [x] 2.1 新增 curated 专家：producer、developer、tester、meeting-scribe、action-owner、copywriter、visual-designer（EXPERT.md + manifest + catalog.json）
- [x] 2.2 workbench-load 幂等确保官方依赖专家已安装启用
- [x] 2.3 更新 workflow-display-name 短名映射

## 3. Shelf supply & launch

- [x] 3.1 `buildWorkflowShelf` 注入官方包；提升官方/seed 择优优先级避免被空壳覆盖
- [x] 3.2 `startWorkflowRun` 对 official + graph 走 `openSavedWorkflowGraph`
- [x] 3.3 仓库 `team-run` 标记 deprecated，避免与官方研发旗舰重复
- [x] 3.4 确认旧 Demo 空壳不上架；更新 workflow-supply 测试

## 4. QA artifacts

- [x] 4.1 `npm test` / `npm run lint`
- [x] 4.2 撰写 `evidence/dev-self-test.md` 与 `qa-plan.md`
