# QA Plan：稳定 Agent 流式收尾

## Smoke Scope

- [x] 普通多 chunk 回答：正文持续增长，完成时不闪屏、不重复。（Tester：契约+源码 PASS；在线 LLM ADVISORY 跳过）
- [x] 工具调用回答：执行过程运行中展开，回答完成后自动折叠。（Tester：fixture PASS）
- [x] 单次完整 flush：正文只显示一次，不清空后重播。（Tester：契约 PASS）
- [x] 待确认写入：执行过程保持展开，批准/拒绝入口可见。（Tester：fixture PASS）
- [x] 用户手动展开完成后的执行过程：可查看工具步骤与结果。（Tester：details 语义+源码 PASS）
- [x] 长 Markdown（标题、列表、表格、代码块）：收尾排版完整，滚动位置稳定。（Tester：静态契约 PASS；Electron 滚动截图 ADVISORY 跳过）
- [x] 生成过程中点击停止：显示正常停止状态，不出现 IPC 克隆错误。（dev 真机 JSON + executor structuredClone PASS）

## 自动化

- `node --test tests/agent-stream-repaint.test.js tests/agent-streaming-integration.test.js`
- `npm test`
- `npm run lint`
- `openspec validate stabilize-agent-stream-completion --strict`

## 反模式检查

- 回答先完整出现，随后突然消失并重新打字。 → Tester：**PASS**（静态）
- 执行过程折叠时连带替换或移动最终回答。 → Tester：**PASS**（静态）
- 每次阶段更新都重播动画或关闭用户展开的工具详情。 → Tester：**PASS**（静态）
- 存在待确认步骤却自动折叠，导致审批入口不可发现。 → Tester：**PASS**（静态）
- 取消结果透传执行器内部对象，导致 `An object could not be cloned`。 → Tester：**PASS**（JSON + 契约）

## Tester 执行记录（2026-08-06）

- 报告：`evidence/test-report.md`
- Smoke 机器可读：`evidence/tester-stream-completion-smoke.json`
- 脚本：`evidence/tester-stream-completion-smoke.js`
- 结论：**PASS**（ADVISORY：无 API Key 在线 LLM、无并行 Electron 截图）
