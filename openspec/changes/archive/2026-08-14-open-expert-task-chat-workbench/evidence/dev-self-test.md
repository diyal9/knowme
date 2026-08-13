# 开发自测

日期：2026-08-11（含工作台直接开工补齐）

## 结果

- `npm test`：通过，1648/1648。
- `npm run lint`：通过，`lint ok`、`script-scope ok`。
- `npx openspec validate open-expert-task-chat-workbench --strict`：通过（若本地 openspec 在 path 上）。
- Electron 真机冒烟：既有 12/12；本轮增量以静态交接断言锁定（workbench start → task-room）。

## 真机覆盖

- 新建专家任务后直接进入工作台 task-room，没有打开 Agent Graph。
- 左侧显示真实专家 Session，任务目标只预填到 Composer，没有自动发送。
- 专家首屏显示属性、专业能力、技能/连接器和知识库。
- 弹窗选择的知识库持久化到 Session；对话内切回默认知识范围后即时持久化。
- 从最近任务重新打开时恢复同一 Session，没有重复创建。
- **增量**：工作台专家详情「开始对话」创建任务 + 铺开 task-room，不再 `openAgentChat`；能力面专家库开工仍走助理 Session。

## 证据

- 报告：`expert-task-chat-electron-smoke.json`
- 创建弹窗：`screenshots/task-composer-with-knowledge.png`
- 专家任务工作间：`screenshots/expert-task-chat-room.png`
- 交接断言：`tests/expert-task-chat-workbench.test.js`（含 workbench surface start 分支）
