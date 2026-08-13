## Why

Agent 对话里工具调用（如 `run_task`）超时后，进度卡仍长时间停留在「正在调用工具」，回答已写出失败但步骤未收口；用户无法分辨是死等还是在重试。外层超时与底层进程杀停不同步，加重「卡住」体感。需要立刻收口超时态、杀掉孤儿进程，并用可见的指数退避重试。

## What Changes

- 工具执行超时后 MUST 立即将对应 trace 步骤标为失败/超时，不得无限 `pending`
- 超时或取消时 MUST 终止本 Run 关联的底层进程（如 `run_task` 子进程）
- 网络/超时类重试 MUST 使用指数退避，并在执行进度中展示「第 N 次重试 / 等待 Xs」
- 重试耗尽后 MUST 收敛为可读错误，进入既有反思或最终回答路径

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `agent-tool-execution`: 明确超时杀进程、指数退避可见、超时后步骤立即收口
- `agent-thinking-timeline`: 执行进度对超时/退避重试的展示要求

## Impact

- `src/main.js`、`src/lib/agent-run-executor.js`：工具超时 race、取消与重试事件
- `src/lib/agent-process-tools.js`：`run_task` 响应 abort / 超时杀进程
- `src/lib/agent-recovery.js`：超时类退避参数（指数）
- `src/workspace-agent.js`：进度文案（重试/超时）
- 测试：`tests/agent-recovery.test.js`、`tests/agent-process-tools.test.js` 及必要时新增超时收口用例

## 目标用户

在工作台与 Agent 对话中发起工具调用、观察执行进度的 C 端用户。

## 验收标准

1. 单次工具超时后，进度步骤在超时时刻变为错误/超时态，不再长期绿点「正在调用」
2. `run_task` 等进程类工具在超时后子进程被终止（不再继续跑满内部更长 timeout）
3. 可重试错误按指数退避等待，进度可见「第 N 次重试」与等待秒数
4. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改管线 Daemon 任务本身的失败语义（如 `rdpi-*` 业务失败）
- 不调整 LLM 模型侧超时或对话流协议版本
- 不引入新的第三方重试库
