# Parity Matrix — migrate-renderer-react-ts

基线 commit：`f6ad048`（分支 `refactor/renderer-react-ts` 起点）。对比方式：同一用户路径在 `KNOWME_RENDERER=legacy` 与 `vite` 下各走一遍。

| ID | 能力 | Legacy 路径 | Vite 路径 | 状态 |
|----|------|-------------|-----------|------|
| P-01 | 打开唯一 workspace 窗 | `workspace.html` | Vite workspace + LegacyHost | pass (hosted) |
| P-02 | 侧栏 rail 切换助理/工作台 | `workspace.js` rail | 同左（hosted DOM） | pass (hosted) |
| P-03 | 工作流 shelf 列表/搜索/启动 | `workbench` shelf | hosted | pass (hosted) |
| P-04 | taskhome 任务编排 | `workbench` taskhome | hosted | pass (hosted) |
| P-05 | run / task-room | `workbench` run | hosted | pass (hosted) |
| P-06 | Daemon 审阅/HITL/制品 | daemon review surface | hosted | pass (hosted) |
| P-07 | manage 面板 | manage surface | hosted | pass (hosted) |
| P-08 | studio 画布 | studio surface | hosted | pass (hosted) |
| P-09 | 助理 Session / 发送流 | `workspace-agent.js` | hosted | pass (hosted) |
| P-10 | preload API 关键族可用 | `window.api` | typed `window.api` + 同 preload | pass |
| P-11 | 用户数据目录不变 | `%APPDATA%\KnowMe\` | 同左 | pass |

状态说明：`pass (hosted)` = Vite 入口经 LegacyHost 挂载与 legacy 相同 DOM/脚本，产品行为对等；后续可将 `surfaces/registry.ts` 逐项改为 `react` 并复验。
