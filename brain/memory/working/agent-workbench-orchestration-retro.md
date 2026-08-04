# Story Done: agent-workbench-orchestration

三角色门禁已跑完并归档。当前无活跃 change。

## 交付

- 图中聊天气泡按钮 `#btnRailAi` 改为「工作台」入口；新增顶层 `mode-workbench`。
- 工作台模式：右侧 AgentTeams 角色卡 + 工作流 DAG + 编排运行日志，左侧保持对话。
- 只读读取外部 workbench 项目（默认 `D:\workflows\workbench`，`workbenchRoot`/`STICKY_WORKBENCH_ROOT` 可覆盖）。
- 客户端编排引擎：agent 派单（`workbench-dispatch` 无 Session 副作用流式）/ gate 人工分支 / script·loop 人工推进 / parallel 顺序 / terminal 收尾。

## 新文件 / 关键接线

- `src/lib/workbench-model.js`（纯模型，14 单测）、`src/workbench.js`（渲染器+引擎）
- IPC：`workbench-load` / `workbench-workflow` / `workbench-dispatch`（+ `workbench-stream-chunk`）
- 主规格：`openspec/specs/agent-workbench/spec.md`

## 门禁证据

| 阶段 | 结果 | 路径 |
|------|------|------|
| 开发自测 | PASS | `archive/2026-07-22-agent-workbench-orchestration/evidence/dev-self-test.md` |
| 制作人验收 | PASS（附条件） | `.../acceptance.md` |
| 测试 QA | PASS | `.../evidence/test-report.md` |
| Code Review | PASS | `.../code-review.md` |

## Gate Check

| 检查项 | 级别 | 结果 |
|--------|------|------|
| `npm test` | 硬 | PASS（151/151） |
| `npm run lint` | 硬 | PASS |
| qa-plan + Smoke | 软 | PASS |
| code-review | 软 | PASS |

## 复盘要点 / 后续

- 实机 UI 截图（进入工作台 / DAG / 运行日志）未采集——桌面 Electron 无远程调试端口，改用「复刻 main.js 读取逻辑」的 Node 验证数据链路（11 Agent / 17 工作流 / feat-code-lite 14 节点解析 PASS）。后续如需可视化证据，补 `evidence/screenshots/`。
- Non-goals（后续 Story 候选）：parallel 真并行、script/loop 真实外部执行、`workbenchRoot` 设置页 UI、编排运行日志持久化。
- 学习：外部只读集成用 `readJsonSafe`/`readTextSafe` 吞异常 + `workbench-load` 降级分支，避免路径缺失白屏。
