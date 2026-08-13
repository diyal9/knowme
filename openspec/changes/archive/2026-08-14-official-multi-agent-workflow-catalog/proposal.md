## Why

工作流货架在去掉 Demo 垂直种子后只剩个人/仓库/Daemon 条目，缺少能体现「多 Agent 协作 + Gate 门禁 + 可复跑」的官方参考标准。用户需要三条真落地、可运行的官方工作流，作为编排与验收标杆，而不是助手里一句话能做完的单聊任务。

目标用户：用工作台启动稳定协作流程的个人与小团队；内部以此为 Studio / Runtime 回归样板。

商业化与体验价值：货架「官方」标签重新可信；办公 / 研发 / 视觉三类各有一条旗舰；降低「不知工作流和助手有何区别」的认知成本。

## What Changes

- 新增官方工作流目录：三条可执行 Workflow Package（完整 graph：多 Agent + Gate + 交接意图）。
  1. **会议闭环**（办公）：纪要 Agent → Gate(负责人/截止日) → 待办编排 → 同步 Agent
  2. **三角色协作交付**（研发）：制作人 → Gate → 开发 → Gate(test/lint) → 测试
  3. **Brief 出图审阅**（视觉）：文案 → 视觉提示词 → Gate(人工选版/导出) → 终态
- 补齐官方包依赖的 curated 专家（若目录中不存在），并在工作台加载时幂等确保安装启用。
- 货架重新注入上述官方包（`source: official`），**不是**旧版空壳 Demo 种子。
- 本地启动：官方包有 graph 时走 Agent Graph / local-team Runtime（与个人编排同路径）。
- 仓库 `team-run` 标记为 deprecated/隐藏，避免与官方研发旗舰重复。
- 旧 Demo 种子 id 仅保留自动化/历史解析兼容，不再上架。

## Capabilities

### New Capabilities

- `official-workflow-catalog`：官方多 Agent 工作流目录的供给、展示与可运行性契约。

### Modified Capabilities

- `workbench-workflow-shelf`：允许注入「真实可执行」的官方参考工作流；禁止空壳 Demo。
- `workflow-package`：官方包只读、可 fork；启动走 local-team graph。

## Impact

- `src/lib/official-workflows.js`（新建）
- `src/lib/workflow-supply.js` / `src/main.js` / `src/ipc/workbench-load.js`
- `src/workbench.js`（官方包启动路径）
- `src/catalog/experts/*` + `catalog.json`
- `src/lib/workflow-display-name.js`
- `.cursor/workflows/index.json`
- 测试：`tests/official-workflows.test.js` 等

## 验收标准

1. 货架「全部」可见三条官方卡，分属办公 / 研发 / 视觉，徽章为「官方」。
2. 每条 ≥2 个独立 Agent + ≥1 个 Gate；卡片步骤数与 DAG 可读。
3. 依赖专家已安装时显示可运行；启动走 local-team / Agent Graph，可停在 Gate 等待确认。
4. 旧 Demo 空壳（`office-meeting-to-actions` 等）不上架；`team-run` 仓库投影不抢镜。
5. `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不恢复旧垂直切片空壳 Demo。
- 不强制依赖 Daemon / 图像供应商才能显示官方卡（视觉以文案+提示词+人审 Gate 为可交付闭环；有图模再增强）。
- 不删除用户个人「我的」副本。
- 不重写 AgentTeamWorkflowRunner 内核。
