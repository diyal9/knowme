# 开发实施映射

## 建议提交顺序

| 切片 | 先改 | 主要测试 | 可独立审查结果 |
|---|---|---|---|
| 1. Reducer 判定 | `agent-message-state.ts`、`agent-v2-runtime.ts` | output protocol + assistant renderer | V2 rejected event 不再 fallback |
| 2. Context phase | `context-engine/*`、`agent-context-finalize.ts`、expert prepare | context-engine + expert runtime | planning control 不进入执行 |
| 3. Message reference | shared DTO、expert task writer、expert feed | transcript persistence + expert room | 同一回答一次投影 |
| 4. Planning contract | shared planning contract、expert planning/receipt | expert plan confirmation | structured ready/clarifying + 合同 fingerprint |
| 5. Recovery fence | Run Store/manager、receipts、expert retry | recovery + checkpoint + fault injection | retry/cancel/uncertain 安全收敛 |
| 6. Lane adapters | partner generate、workflow runner/runtime | partner + workflow integration | 各 lane 语义保持 |
| 7. UI/发布 | expert room/styles、metrics/docs | renderer + Electron + full gate | 原截图闭环与可发布证据 |

每个切片先写失败用例，再修改最小生产代码，跑定向测试。公共层切片合入前必须运行三 lane 兼容用例。

## 关键实现点

### Reducer

- 保留 `changed` 与 `ignored` 供现有调用方使用，新增 `decision`。
- `applyRuntimeStreamEvent` 先判断是否为 V2，再根据 decision 处理；不能用 `changed=false` 代表“应走 fallback”。
- legacy fallback 只接收显式 legacy event 或 reducer 模块不可用时的 legacy 通道。

### Context

- 复用 `normalizeContextBlock` 与 `appliesTo.phases`。
- 在候选选择/最终装配两个边界都断言 phase，避免调用方遗漏。
- host control 只存在于本轮 Context Draft/Manifest；Task/Session writer 不保存其正文。

### Planning

- v1 envelope parser/validator 放在 shared 或 lib 的单一事实源，Renderer 不自行判断 ready。
- Main 返回经过 host 校验的 planning state 和 contract fingerprint。
- `analyzeExpertPlanningReply` 只服务旧记录兼容和迁移测试。
- 现有 confirmation receipt 的 TTL、一次性消费与 task/expert 绑定保持。

### Message projection

- `answer.committed`、Session persist 和 expert Task reference 使用同一 assistantMessageId。
- feed 合并优先 ID/reference/provenance；anonymous legacy 才使用确定性兼容键。
- attention 卡只携带 action、关联 message/plan/receipt ID 和短摘要。

### Recovery

- Checkpoint 保存引用与版本，不保存完整对话或工具参数。
- terminal/frozen fence 在 host 和 Renderer 两侧都校验。
- receipt 的迟到保存路径不得调用 answer commit 或 Task completed transition。

## 开发前检查

1. `node .cursor/scripts/harness.js preflight --json`
2. 对将修改的每个函数执行 GitNexus upstream impact。
3. 检查 `git status --short`，只碰本 change 需要的文件，保留用户现有修改。
4. 运行对应失败基线，保存预期失败原因。
5. 确认没有把已完成 OpenSpec 的历史 evidence 当成本 change 的证据。

## 每个切片完成检查

1. 定向测试通过。
2. `git diff --check` 通过。
3. 新增字段在 `src/shared/api.ts` 有唯一声明。
4. 没有新增 Renderer `ipcRenderer`、全局单例或重复事实源。
5. 日志、manifest、checkpoint 和 receipt 不包含敏感正文/参数。
6. 公共切片的 partner/expert/workflow 代表回归通过。

## 停止条件

遇到以下任一情况暂停该切片并记录设计偏差，不能临时绕过：

- GitNexus 返回 HIGH/CRITICAL 且直接调用方未纳入任务。
- 新 planning envelope 需要额外模型调用才能工作，超出本设计性能边界。
- 旧任务必须破坏性迁移才能打开。
- 工作流必须放弃 node attempt/parent-child 才能接入公共字段。
- uncertain 外部操作只能靠自动重放才能继续。
- 需要按纯文本删除历史消息才能消除重复。

## 交付物

- 源码与测试。
- 更新后的 `docs/architecture.md` 或运行说明。
- `evidence/test-report.md`、桌面验收证据、`code-review.md`。
- 如设计偏离，先更新本 change 的 proposal/design/specs，再继续实现。
