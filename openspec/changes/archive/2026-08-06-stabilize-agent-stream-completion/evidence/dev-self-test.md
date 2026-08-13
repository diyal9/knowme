# 开发自测报告

- 日期：2026-08-06
- Change：`stabilize-agent-stream-completion`
- 角色：开发

## 结果

- OpenSpec strict validate：PASS
- 定向测试：PASS（取消态与流式集成 19/19；原流式收尾 23/23）
  - `tests/agent-stream-repaint.test.js`
  - `tests/agent-streaming-integration.test.js`
  - `tests/agent-run-executor.test.js`
- 完整 `npm test`：PASS（1187/1187）
- `npm run lint`：PASS（lint ok；script-scope ok）
- IDE diagnostics：0 error
- Electron 重启：PASS
  - 主进程成功启动：`KnowMe 主进程启动`
  - Renderer 无业务 uncaught error
  - 仅有开发态既有 Electron CSP warning，不属于本 change 回归

## 行为核对

- 单次非空 stream flush 记为已展示正文，完成时不再进入清空打字重放。
- 成功收尾改走 `completeAssistantBubble`，不再全量调用 `renderChat()`。
- 已显示 `.chat-text` 容器在完整 Markdown 收尾时保留节点身份，仅 reconcile 变化子节点。
- 执行过程运行时展开；完成后在同一 `<details>` 节点移除 `open`。
- trace 含 `requiresApproval` 时执行过程保持展开，`draftId` 与审批卡目标被保留。
- Run artifacts 只局部同步，不替换既有消息 DOM。

## 取消态 IPC 回归（2026-08-06）

- 根因：kernel 取消分支将含函数与 `AbortSignal` 的内部 `ports` 随执行结果透传给 Electron IPC，触发 `An object could not be cloned`。
- 修复：`AgentRunExecutor` 公开结果移除 `ports/runStartedAt`；`ai-generate` 取消分支显式返回 `error/cancelled/runId`。
- 自动化：取消结果通过 `structuredClone`，并有静态契约防止再次展开整个 `kernelResult`。
- Electron 真机：PASS；运行中点击停止后正常收尾，无 IPC 克隆错误、无 Renderer console error。
- 证据：
  - `evidence/cancel-ipc-smoke.js`
  - `evidence/cancel-ipc-smoke.json`
  - `evidence/screenshots/cancel-ipc-smoke.png`

## 制作人验收建议

1. 发起一个会调用读取工具的 Agent 请求。
2. 观察运行时“执行进度”展开并持续追加步骤。
3. 回答开始显示后确认正文没有消失或从头重播。
4. 完成后确认上方折叠为“执行过程”，正文原位不闪跳。
5. 发起会生成写入草稿的请求，确认待批准时执行过程保持展开。
