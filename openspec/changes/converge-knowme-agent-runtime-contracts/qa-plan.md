# QA 计划

## 测试原则

- 公共契约的每次改动同时覆盖 partner、expert、workflow 代表路径。
- 使用临时 userData、临时 Task Store 和模拟 Provider；不得修改生产 `%APPDATA%\KnowMe\` 数据。
- 模拟外部写只通过主进程 test seam，Renderer payload 不能携带 fake apply。
- 不以正文相同作为消息去重依据；用 message/run/reference provenance 断言。
- 自动测试通过不替代目标 Electron 页面真实截图、刷新和重启验收。

## Smoke Scope

- [ ] planning-only 控制块不会进入 expert-execution；真实用户同文约束仍保留。
- [ ] V2 duplicate/late/frozen/invalid/unsupported 事件不进入 answer fallback。
- [ ] 实时事件、Task event、attention 与恢复数据只形成一个 canonical assistant message。
- [ ] 新 planning outcome 的 clarifying/ready 互斥，格式错误和未决问题均 fail closed。
- [ ] 内部步骤变化不重新确认；范围、交付、验收、外部目标、材料边界和风险变化会重新确认。
- [ ] plan confirmation、operation approval、delivery acceptance 三种状态独立。
- [ ] partner 无 Task 直接回答保持可用；工具回答和取消不重复正文。
- [ ] workflow root/child/node attempt/human gate 保持现有语义，旧 attempt 迟到事件不污染新 attempt。
- [ ] checkpoint/event log/contract fingerprint 不一致时拒绝自动恢复。
- [ ] uncertain 非幂等操作不自动重放；取消后的迟到回执可审计但不改变 cancelled 终态。
- [ ] 目标截图页面长标题、右栏信息和输入区展示正确，回答不重复。
- [ ] 旧专家任务、旧 Session 和无新字段 Workflow Run 可确定性读取。

## 分层测试

### 纯规则与协议

- `tests/agent-output-protocol.test.js`
- `tests/context-engine.test.js`
- `src/domain/expert-collab-plan.spec.ts`
- 新增 identity/planning contract validator 测试。

覆盖 decision 枚举、phase scope、fingerprint、legacy reader 和消息引用合并。

### 主进程集成

- `tests/expert-plan-confirmation.test.js`
- `tests/expert-task-runtime.test.js`
- `tests/expert-task-recovery-boundaries.test.js`
- `tests/expert-task-operation-approval.test.js`
- `tests/agent-runtime-transcript-persistence.test.js`
- `tests/agent-approval-recovery-context.test.js`
- `tests/tool-execution-approval-checkpoint.test.js`
- `tests/workflow-v2.test.js`
- `tests/workbench-agent-runtime.test.js`

覆盖 host 校验、receipt、checkpoint、重试 lineage、取消和父子 Run。

### Renderer

- `src/renderer/features/expert/expert-task-room.spec.tsx`
- `src/renderer/features/expert/expert-display-regression.spec.tsx`
- `src/renderer/features/expert/expert-layout-contract.spec.ts`
- `src/renderer/features/assistant/assistant.spec.tsx`

覆盖同一消息 upsert、确认动作、等待/执行/验收分区、失败后 composer 与窄侧栏布局。

### 故障注入矩阵

| 故障点 | 预期 |
|---|---|
| planning envelope 非法 | 一次有界修复，仍失败则 clarifying，不签 receipt |
| answer event 重复 | decision=duplicate，无第二气泡 |
| terminal 后 answer 到达 | decision=frozen，正文不变 |
| 旧 Run 事件在 retry 后到达 | 只归属旧 Run，不更新新 Run/Task |
| checkpoint 超前于 event log | `resume_unsafe`，不 dispatch |
| Provider 成功、receipt 前崩溃 | 恢复为 uncertain/待核实，不盲目重试 |
| cancel 后 Provider 回执成功 | 保存 receipt；Run 仍 cancelled |
| workflow attempt 1 迟到 | 不覆盖 attempt 2 或 root Run |

## Electron 人工验收

1. 使用隔离 userData 打开与原截图相同的专家委托。
2. 验证规划回答只出现一次，右侧目标和交付内容完整换行。
3. 确认计划，观察状态进入执行；执行 prompt 中不存在 planning host instruction。
4. 在执行中刷新，再重启应用，确认 canonical message、状态和操作卡不重复。
5. 制造一次执行失败，验证 composer 可讨论且不会自动重试。
6. 取消一次已派发的模拟写操作，注入迟到成功回执，确认任务仍显示取消且审计可读。
7. 打开伙伴对话和本地工作流代表任务，验证未出现专家式确认或验收 UI。

## 命令与通过条件

```powershell
node -r ./scripts/register-ts.js --test tests/agent-output-protocol.test.js tests/context-engine.test.js tests/expert-plan-confirmation.test.js tests/expert-task-runtime.test.js tests/expert-task-recovery-boundaries.test.js tests/agent-runtime-transcript-persistence.test.js tests/workflow-v2.test.js tests/workbench-agent-runtime.test.js
npm run test:renderer -- src/domain/expert-collab-plan.spec.ts src/renderer/features/expert/expert-task-room.spec.tsx src/renderer/features/expert/expert-display-regression.spec.tsx src/renderer/features/assistant/assistant.spec.tsx
npm run check
npm run typecheck:lib
npm run openspec:health
node .cursor/scripts/harness.js gate --json --change converge-knowme-agent-runtime-contracts
```

新增测试文件在实现后加入对应定向命令。最终必须以完整 `npm run check` 为硬门禁。

通过条件：专项与全量测试无新增失败；所有 Smoke Scope 有证据；Electron 验收有截图/日志；未授权真实外部写入保持未执行；任何限制清楚写入 test-report。
