## Why

从「管线服务」打开运行审阅后点「返回」，会落到「工作流」货架，而不是回到管线服务。根因是 `restoreTaskRoomReturnState` 写死 `setSurface('shelf')`，且打开 daemon 任务时未记录来源面。工作台其它返回入口也需按入口来源对齐，避免跨 Tab 误跳。

### 目标用户

在任务 / 工作流 / 管线服务之间切换、从运行审阅退回上一层的日常用户。

### 商业化与体验价值

返回目标错误会让管线服务像「半截功能」：用户刚在管线里点开失败 run，却被扔回工作流，打断排查闭环，降低对远程执行入口的信任。

## What Changes

- 进入运行面 / 专家任务房时记录来源 surface（`taskhome` / `shelf` / `daemon`）。
- 「返回」按来源回到对应一级面：管线 → 管线服务；货架/编排 → 工作流；任务/专家房 → 任务。
- Daemon 底栏「返回」与顶栏 `#wbRunBack` 统一走同一恢复逻辑，不再只 `resetRun` 停在空运行面。
- 工作流对话房（从货架进入）关闭时回到货架，而非任务首页。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-workbench`：运行面 / 任务房「返回」须按进入来源回到任务、工作流或管线服务，禁止一律落到货架。

## 验收标准

- 管线服务 → 打开 team-run 等任务 → 顶栏/底栏「返回」→ 回到管线服务 Tab。
- 工作流货架 → 运行 / 对话房 →「返回」→ 回到工作流货架。
- 任务首页 → 专家任务房 →「返回」→ 回到任务首页。
- 工作流管理「返回」→ 货架；自动化「返回」→ 任务；编排「返回」→ 货架（保持既有正确行为）。
- 相关静态契约测试通过；`npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改 Run / Daemon 状态机、轮询或审阅 Tab 内容。
- 不重做顶栏 chrome 去重（已有 `dedupe-workflow-run-back-chrome`）。
- 不做浏览器式多级历史栈，仅「进入时捕获一层来源」。

## Impact

- `src/workbench.js`：`captureTaskRoomReturnState` / `restoreTaskRoomReturnState` / `openDaemonTask` / `closeExpertTaskRoom` / `handleRunAction('back')`
- `tests/workbench-templates.test.js`（契约断言）
- OpenSpec：`openspec/changes/fix-workbench-back-navigation/`
