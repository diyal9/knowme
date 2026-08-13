# 开发自测报告

- 日期：2026-08-09
- Change：`unify-workbench-pipelines-and-agent-studio`
- npm test：PASS（1528/1528）
- npm run lint：PASS
- Electron closure smoke：PASS（39/39，控制台错误 0）
- Electron vertical smoke：PASS（19/19，控制台错误 0）

## 本次结构补全（视觉审计 follow-up）

- [x] 任务列表/任务工作间均保持「工作」Tab active（`onWork` 含 tasks 面）
- [x] 任务页 queue-detail：task-room 下左侧运行队列 + 右侧详情同屏；非 task-room 仅队列
- [x] Agent 资源页改为 list-detail（`.wb-split-console` / `.wb-agent-console`），详情内 primary「用此 Profile 新建运行」
- [x] `workbench-console.css` 收敛 `.wb-head/.wb-body/.wb-tab` 与 760px/focus/reduced-motion 权威定义
- [x] Agent Graph 多 gate 仅首个 primary；degraded 时 runner 不再叠加第二个 primary
- [x] cancelled / permission / degraded 语义类挂载到 `#wbRunStatus`
- [x] 任务工作间 `#workSurfaceWrap` 下限由 300px 调整为 340px

## 备注

- Agent list-detail 与任务 queue-detail 已进入 Electron 行为断言和截图证据。

## 第 10 阶段四页职责重构（2026-08-10）

- `npm test`：PASS（1544/1544）
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- OpenSpec strict：PASS
- 四页 Electron smoke：PASS（14/14，控制台错误 0；1360×860 与 720×640）
- 制作人体验验收：PASS
- 测试角色正式 QA：PASS，BLOCKING 0
- 关键闭环：本地/Daemon catalog 分流、本地 Agent Package/Profile 保存、工作流仅本地节点、Daemon 固定阵容只读、Package/Profile 快照重启恢复。
