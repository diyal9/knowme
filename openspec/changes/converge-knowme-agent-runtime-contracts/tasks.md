# 实施任务

规则：每项独立完成、独立回归且预计不超过 2 小时；修改函数前执行 GitNexus upstream impact。HIGH/CRITICAL 先记录风险与直接调用方，再继续实施。所有勾选必须有对应测试或审查证据。

## A. 基线与共享契约

- [ ] **A1（≤1h）** 在临时 Task/Session fixture 固化“重复回答 + planning 指令污染 + 侧栏截断”的失败基线，不读写生产用户数据。（spec: Derived task surfaces reference canonical messages；Host control context is phase scoped）
- [ ] **A2（≤1h）** 为 partner、expert、workflow 各增加一份当前行为 fixture，记录 task/turn/run/message/node attempt 关联。（spec: Shared runtime contracts preserve lane-specific orchestration）
- [ ] **A3（≤2h）** 在 `src/shared/api.ts` 增量定义 lane、retry/root/parent/node/message 关联 DTO，并确保全部新增字段 optional、structuredClone 可用。（spec: Run identity preserves lane and retry lineage）
- [ ] **A4（≤1h）** 增加共享 identity 规范化与校验单测，覆盖 partner 无 task、workflow 无 message、expert retry 三种合法形态。（spec: Run identity preserves lane and retry lineage）
- [ ] **A5（≤1h）** 记录现有生产者/消费者矩阵并对 DTO 调用方执行源码核对，确认没有第二份同义类型。（spec: Public contract changes require cross-lane regression）

## B. Context phase 隔离

- [ ] **B1（≤1h）** 对 context phase 解析与 `appliesTo.phases` 相关符号执行 GitNexus impact，记录直接调用方和风险。（spec: Host control context is phase scoped）
- [ ] **B2（≤2h）** 在 Context Engine 增加 planning-only block 的 execution phase 排除/拒绝诊断，不改变现有 authority/sourceTrust 语义。（spec: Host control context is phase scoped）
- [ ] **B3（≤2h）** 修正专家正式执行 Context Draft，只从原始用户输入、经校验任务事实和确认合同构造，不复用规划宿主 prompt。（spec: Host control context is phase scoped）
- [ ] **B4（≤1h）** 让 legacy planning 控制记录按 provenance/kind 排除，禁止基于正文正则删除消息。（spec: Host control context is phase scoped）
- [ ] **B5（≤2h）** 增加 phase mismatch、用户真实同文约束、附件提示注入和最新修正优先级测试。（spec: Execution context preserves confirmed constraints with provenance）
- [ ] **B6（≤1h）** 在 ContextManifest 增加无正文的 phase mismatch 诊断断言。（spec: Context phase enforcement is observable without storing control text）

## C. V2 事件判定与唯一回答

- [ ] **C1（≤1h）** 对 `reduceMessageEvent`、`applyRuntimeStreamEvent`、canonical answer commit 和 expert feed 合并符号执行 GitNexus impact。（spec: Event sequence is monotonic and idempotent）
- [x] **C2（≤2h）** 为 message reducer 增加显式 decision，同时保持现有 `changed/ignored` 字段兼容。（spec: Event sequence is monotonic and idempotent）
- [x] **C3（≤1h）** 修改 V2 stream 应用分支：duplicate/late/frozen/invalid/unsupported 不进入 committed fallback。（spec: Legacy events have bounded compatibility）
- [x] **C4（≤2h）** 将 answer commit 与持久化 upsert 绑定到 `runId + assistantMessageId + hash`，验证 invoke 返回值不覆盖正文。（spec: Canonical answer is committed once；ground-persist 使用 `resolveTurnIdentity`、canonical hash 与按 ID upsert，prepare 阶段对已提交 assistant message 提前幂等返回。）
- [x] **C5（≤2h）** 为专家 Task event/attention 增加 `messageId` 引用 writer，并保留旧记录兼容字段。（spec: Derived task surfaces reference canonical messages；交付事件 writer 已绑定 `runtimeMessageId(runId, 'assistant')`，旧事件仍可无引用归一化。）
- [x] **C6（≤2h）** 将 expert feed 改为按 ID/provenance/reference 合并；移除对新记录的纯文本正文去重依赖。（spec: Derived task surfaces reference canonical messages；Feed 按 canonical message ID 过滤引用事件，legacy 无引用事件保持可见。）
- [x] **C7（≤2h）** 增加 duplicate、late、frozen、unsupported、gap、refresh restore、legacy-only 六类协议测试；V2 runtime 覆盖刷新后 canonical answer 防重放，legacy stage 事件保持兼容。（spec: Event sequence is monotonic and idempotent；Legacy events have bounded compatibility）
- [x] **C8（≤2h）** 增加普通伙伴回答和工作流 subrun 事件回归，确认 reducer 修改不产生重复正文或错误终态。（spec: Public contract changes require cross-lane regression；agent-message-state 与 agent-team-runtime-governance-ui 回归通过。）

## D. 结构化专家规划与确认

- [ ] **D1（≤1h）** 对专家规划 parser、规划 Context、确认 receipt 和任务创建符号执行 GitNexus impact。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D2（≤2h）** 在 shared 层定义 `ExpertPlanningOutcome`、`ExpertCommissionContract`、`ExpertExecutionPlan` 与有界 validator。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D3（≤2h）** 让 expert-planning 请求新 writer 产出版本化 envelope，提取唯一 `displayText`；控制 JSON 不进入 Markdown。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D4（≤2h）** 增加一次有界格式修复和 fail-closed 分支；失败后保留 composer 与待澄清状态。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D5（≤2h）** 在主进程校验未决问题、交付物、能力、权限和材料边界；未通过时拒绝签发 receipt。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D6（≤1h）** 为旧任务保留文本 planning reader，新一轮重新规划写入结构化版本。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **D7（≤2h）** 将现有 plan fingerprint 拆为用户合同 fingerprint 与内部计划 version；合同 fingerprint 排除 steps。（spec: Confirmed commission contract is separate from the internal execution plan）
- [ ] **D8（≤1h）** 更新 confirmation receipt 绑定 task/expert/contract/policy version，并保持十分钟、一次性语义。（spec: Confirmed commission contract is separate from the internal execution plan）
- [ ] **D9（≤2h）** 为内部步骤调整、交付范围变化、外部目标变化、风险变化增加确认失效测试。（spec: Confirmed commission contract is separate from the internal execution plan）
- [ ] **D10（≤2h）** 验证 plan confirmation、tool draft approval、deliverable acceptance 三类记录和 UI 状态互不推导。（spec: Planning confirmation operation approval and delivery acceptance are independent）

## E. 专家房投影与布局

- [ ] **E1（≤2h）** 将专家 planning state、确认按钮和文字确认统一读取结构化 outcome/host gate；legacy 只走兼容 reader。（spec: Expert planning produces a host-validated structured outcome）
- [ ] **E2（≤2h）** 将回答、执行过程、交付物与操作卡分区渲染；有 canonical message 时不渲染 Task event 正文。（spec: Expert collaboration renders one canonical answer and separate actions）
- [ ] **E3（≤1h）** 修复委托标题、目标、交付信息在窄侧栏的换行、ellipsis 和滚动边界。（spec: Expert collaboration renders one canonical answer and separate actions）
- [ ] **E4（≤2h）** 增加 ready/clarifying/confirm/executing/review/reload 组件回归和截图尺寸回归。（spec: Expert collaboration renders one canonical answer and separate actions）
- [ ] **E5（≤1h）** 验证新任务默认 review、旧 automatic 兼容恢复和已接受任务终态不受本变更影响。（spec: Planning confirmation operation approval and delivery acceptance are independent）

## F. 取消、重试与恢复

- [ ] **F1（≤1h）** 对 checkpoint save/load/resume、tool receipt 和 cancel cascade 符号执行 GitNexus impact。（spec: Checkpoint recovery validates identity decisions and receipts）
- [ ] **F2（≤2h）** 将 identity、合同/内部计划版本、pending decision/draft refs 和 receipt refs 写入有界 checkpoint。（spec: Checkpoint recovery validates identity decisions and receipts）
- [ ] **F3（≤2h）** 恢复时校验 event log、identity lineage 和合同 fingerprint；不一致返回可操作的 `resume_unsafe`。（spec: Checkpoint recovery validates identity decisions and receipts）
- [ ] **F4（≤2h）** 专家重试创建新 runId/retry lineage，隔离旧 Run 迟到事件。（spec: Run identity preserves lane and retry lineage）
- [ ] **F5（≤2h）** 取消后停止新工作并冻结投影，同时允许 host 保存已派发操作的迟到 receipt。（spec: Cancellation freezes projection while preserving late execution evidence）
- [ ] **F6（≤2h）** 增加 crash-before-dispatch、provider-success-before-receipt、uncertain、cancel-late-success 和 stale-checkpoint 故障注入测试。（spec: Checkpoint recovery validates identity decisions and receipts；Cancellation freezes projection while preserving late execution evidence）

## G. Partner 与 Workflow 兼容

- [ ] **G1（≤1h）** 为 partner adapter 补齐 lane/turn/message identity，不新增 formal task 或 planning gate。（spec: Shared runtime contracts preserve lane-specific orchestration）
- [ ] **G2（≤2h）** 覆盖伙伴直接回答、工具回答、取消、刷新恢复四条集成路径。（spec: Public contract changes require cross-lane regression）
- [ ] **G3（≤2h）** 为 workflow agent node 补齐 root/parent/nodeAttempt identity，保持现有 idempotency key 和 child Run 行为。（spec: Workflow parent child and attempt identity remain isolated）
- [ ] **G4（≤2h）** 验证 LLM-only、tool-only、human/gate node 不被映射成专家 Task/Turn/approval。（spec: Shared runtime contracts preserve lane-specific orchestration）
- [ ] **G5（≤2h）** 增加 attempt 1 迟到事件、attempt 2 运行、兄弟 child Run 与 root Run 隔离测试。（spec: Workflow parent child and attempt identity remain isolated）

## H. 兼容、观测与发布

- [ ] **H1（≤2h）** 为新 planning contract/message reference/checkpoint 字段增加 additive reader/writer version 测试。（spec: Legacy events have bounded compatibility；Expert planning produces a host-validated structured outcome）
- [ ] **H2（≤1h）** 增加不含正文的指标：规划解析失败、reducer reject、重复投影抑制、resume rejection、uncertain operation。（spec: Context phase enforcement is observable without storing control text）
- [ ] **H3（≤1h）** 增加新 planning writer 本地回退开关；证明开关不撤销 V2 拒绝、权限和批准安全边界。（spec: Public contract changes require cross-lane regression）
- [ ] **H4（≤1h）** 更新架构/运行说明，记录 lane 边界、事实源和恢复判定。（spec: Shared runtime contracts preserve lane-specific orchestration）
- [ ] **H5（≤2h）** 运行全部专项 Node/Renderer 测试并保存结果到 evidence。（spec: 全部）
- [ ] **H6（≤2h）** 运行 `npm run check`、`npm run typecheck:lib`、`npm run openspec:health` 和专项 harness gate。（spec: 全部）
- [ ] **H7（≤2h）** 在隔离测试数据上执行 Electron：截图复现、确认执行、刷新、重启、失败讨论、取消恢复。（spec: 全部）
- [ ] **H8（≤1h）** 执行 GitNexus detect_changes，核对实际影响只覆盖预期符号/流程并记录既有脏工作区边界。（spec: Public contract changes require cross-lane regression）
- [ ] **H9（≤2h）** 完成独立 code review、制作人验收和测试报告；未执行的真实外部写入必须明确标记未验证。（spec: 全部）
