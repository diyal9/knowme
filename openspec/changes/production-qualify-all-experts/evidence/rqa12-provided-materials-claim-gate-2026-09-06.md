# RQA12 — 提供材料未进入 claim gate 与声明支持范围误判

日期：2026-09-06。状态：P1 已诊断；新增行为红测，尚未修复生产代码。

## 范围与结论

仅检查指定隔离 QA 根的两个 task/session/run/checkpoint/log，及当前 grounding 相关源码。此次只新增本报告和 tests/rqa12-provided-material-claims.test.js；未改 src、原始证据、包、用户 profile 或 QA 数据，未操作应用、调用模型/真实 API、运行 fullcheck 或 commit。

确证：这两次最终校验均为 ungrounded_external_fact，工具和 evidence 都为空，而同 run user 消息已经包含完整题面。当前通用 gate 把“结论：”等标题当外部事实，GROUND 只从工具结果重建证据台账，没有把题面材料接入。该机制可以用现有纯函数稳定复现。

**不能恢复首轮及 FINALIZE 原候选正文，因此不能确定两个真实输出的实际触发词就是“结论：”，也不能对被替换的原正文做专业评分。** 纯函数样本是人工构造的最小反例，不是真实候选恢复件。

## 两 run 绑定与真实证据

隔离根：D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de（解析为 D:/UserCaches/Temp 下同名目录）。

| 项目 | RR01 | RR02 |
|---|---|---|
| taskId | task-mtowd8tv-ja8ye | task-mtowf07y-5yet0 |
| runId | expert_task-mtowd8tv-ja8ye_mtowd8zh | expert_task-mtowf07y-5yet0_mtowf0em |
| sessionId | wb-expert-task-mtowd8tv-ja8ye | wb-expert-task-mtowf07y-5yet0 |
| task 状态 | needs_input | needs_input |
| 最终 gate / violation | blocked / ungrounded_external_fact | blocked / ungrounded_external_fact |
| 工具 / evidence / artifacts | 0 / 空 / 空 | 0 / 空 / 空 |
| task execution_blocked 时间（UTC） | 2026-09-05T21:31:07.226Z | 2026-09-05T21:32:23.439Z |

绑定方法及记录位置：

- workbench-tasks.json：严格按上述 taskId 选择对象，executionEvidence.runId 与上述 runId 一致。attention 为 evidence_incomplete/retry，detail 为“还没有可验证的正文证据，不能输出具体议题或责任人”。deliverable primary 为 answer，requiredTools/requiredEvidence/completionConditions 都为空。
- agent-sessions.json：按 taskRef.id 及 messages[].runId 绑定。对应 user 消息包含完整静态评审材料、约束与 SOP；assistant 仅剩“当前缺少可验证的来源证据，不能确认回复中的具体事实。需要先获取相应来源。”，answerHash 均为 768f3d3bbe4240a2。
- agent-runs/<runId>/events.jsonl 第3条 run.terminal：均记录 MODEL → GROUND → VERIFY_CLAIMS → FINALIZE → PERSIST → DONE，toolCalls=0，artifactRefs/evidenceRefs 为空。通用 executor 记录 completed/ok，但任务层依据 blocked 校验拦截，不能据 run.terminal 的 ok 把此题算专业完成。
- agent-runs/<runId>/checkpoints/latest.json：对应 runId/sessionId，phase=persist；evidenceLedger.entries=[]，toolLedger.calls=[]，taskFrame.requiredTools/requiredEvidence/completionConditions=[]。
- logs/knowme-2026-09-06.jsonl：第180/194行 system-prompt 记录分别含上述 runId；底层部分 llm-request/response 没有 runId、也没有正文，不能只按时间将并行响应强绑定。
- session.grounding 另含“材料：用户尚未提供”，与同 run user 完整题面矛盾；这是可见的上下文投影不一致，但 verifyClaims 当前不读取该字符串，不能把它当作已证明的直接触发条件。

## 当前调用链与代码证据

1. agent-run-executor.ts:302 调用 runModelToolLoop，:345 将其 fullText、toolMessages、referenceState、evidenceLedger 等交给 runGroundAndPersist。
2. phases-ground-persist.ts:85—92 在 runtime grounding 下重新创建空台账，仅通过 mergeToolResultsIntoLedgers 合并 toolMessages。即使上游拥有用户/context evidence，该处也未沿用传入台账。
3. phases-ground-persist.ts:121—127 调用 verifyClaims，参数为 text/evidenceLedger/toolLedger/referenceState/taskFrame，没有原题面或独立材料集合。
4. agent-grounding-state.ts:12 的 EXTERNAL_FACT_RE 包含“结论[：:]”，并不区分评审判断、材料引用和外部事实。agent-grounding-ledger.ts:282—291 只抽取匹配到的词片段。
5. agent-grounding-ledger.ts:367—385 以“存在任意 ok 非 discovery evidence”作为全文 supporting evidence；缺少时，又以全文匹配“证据不足”等不确定性词句豁免。因此同时存在过度拦截及过度放行风险。
6. phases-ground-persist.ts:148—169 最多尝试一次 finalizeResponse('grounding')，再用同一台账复验。phases-model-tool.ts:186—227 使用通用最终答复指令，没有传入具体 violation、来源映射或需纠正的 claim。两 run 阶段均显示走过 FINALIZE；原始生成内容及纠正内容未在所查记录保留。
7. phases-ground-persist.ts:171 用 refusal 替换 fullText，之后才 commitCanonicalAnswer 和持久化 assistant；最终结果保留结构化 violation，但不保留候选全文/完整两轮校验快照。
8. agent-grounding-labels.ts:77—78 把 ungrounded_external_fact 映射为“正文证据/议题或责任人”文案；expert-task-runtime.ts:653—670 将 blocked 结果变为 needs_input，不创建普通成功成果。

这不是缺少 Feishu 权限或必需工具导致的 missing_required_tools，也不是根据拒绝文案反推原因；证据为同 run 的结构化 violation。不能据此排除所有前置上下文因素，但通用 gate 的最终阻断路径已确定。

## 纯函数精确复现

从 D:/aispace/knowme 用 PowerShell 执行以下命令；仅调用当前已有导出，不调用模型、服务或应用。使用仓库既有 register-ts 加载器（它可能写普通临时转译缓存，不写用户 profile/QA 根）。

```powershell
node -r ./scripts/register-ts.js -e 'const g = require("./src/lib/agent-grounding-ledger");
const el = g.appendEvidence(g.createEvidenceLedger({runId:"probe"}), {
  source:"user", status:"ok",
  text:"R1每门课恰排一次；A1仅检查总节数。"
});
for (const [label,text,evidenceLedger] of [
  ["colon","结论：需修改。以下仅依据提供材料做静态评审。",{entries:[]}],
  ["no_colon","结论为需修改。以下仅依据提供材料做静态评审。",{entries:[]}],
  ["uncertainty","结论：需修改。证据不足。",{entries:[]}],
  ["user_evidence","结论：需修改。",el]
]) {
  const result = g.verifyClaims({text,evidenceLedger,toolLedger:{calls:[]}});
  console.log(JSON.stringify({label,...result}));
}'
```

实际标准输出（exit 0，表示探针执行成功，不表示被测行为正确）：

```jsonl
{"label":"colon","passed":false,"claims":[{"type":"external_fact","text":"结论："}],"violations":[{"code":"ungrounded_external_fact","message":"具体事实没有正文或权威数据证据支撑"}],"metadata":{"evidenceCount":0,"toolCallCount":0,"hasSupportingEvidence":false}}
{"label":"no_colon","passed":true,"claims":[],"violations":[],"metadata":{"evidenceCount":0,"toolCallCount":0,"hasSupportingEvidence":false}}
{"label":"uncertainty","passed":true,"claims":[{"type":"external_fact","text":"结论："}],"violations":[],"metadata":{"evidenceCount":0,"toolCallCount":0,"hasSupportingEvidence":false}}
{"label":"user_evidence","passed":true,"claims":[{"type":"external_fact","text":"结论："}],"violations":[],"metadata":{"evidenceCount":1,"toolCallCount":0,"hasSupportingEvidence":true}}
```

第四项只证明现有 API 能接收 user evidence 且当下将其视为全文支持，不代表推荐“加一条用户材料便全部放行”的修复。新增红测专门约束这种错误修法。

## 新增测试与红测结果

文件：tests/rqa12-provided-material-claims.test.js。

使用现有 createEvidenceLedger、appendEvidence、createToolLedger、verifyClaims、applyOutputGate；未发明参数/方法，未 stub 被测 gate，未调整生产实现。材料为独立虚构 M1，全文小于240字符，并断言 digest 与完整材料相等，避免把截断问题混入本题；不读取冻结 QA 文件或依赖其路径。

执行：

```powershell
node -r ./scripts/register-ts.js --test tests/rqa12-provided-material-claims.test.js
```

结果：**exit 1；9 tests，5 pass，4 fail，0 skipped/cancelled/todo**。4项均为 ERR_ASSERTION，不是 TypeError、模块加载失败或超时。suite failed 是这4项失败的聚合，不另算一项。

| 测试（按文件顺序） | 期望 | 当前结果 |
|---|---|---|
| 1 静态评审结论冒号/无冒号 | 两者都通过 | RED：实际 [false,true]，期望 [true,true] |
| 2 明确引用完整虚构材料的姓名/日期 | 通过，不声称现实核验 | GREEN |
| 3 材料为李明，引用却称王强 | 拦截矛盾归引 | RED：passed=true |
| 4 正确引用李明，另加无据会议时间 | 不因一处引用有据而全部通过 | RED：passed=true |
| 5 明确标为建议的待批准时段处理 | 通过，不当作已批准规则 | GREEN |
| 6 无回执“我已运行测试，全部通过”，有/无另题“证据不足” | 都拦截 | GREEN |
| 7 有用户材料，无写入回执，却称“我已保存评审文档” | 拦截；用户材料不是操作回执 | GREEN |
| 8 无据确定会议时间，另题“证据不足” | 仍拦截该确定事实 | RED：passed=true |
| 9 真正局限于证据不足的拒绝，没有肯定事实/执行声明 | 通过 | GREEN |

关键区别：**全篇不确定性当前能豁免 external_fact，但没有豁免所测无回执 execution 声明。** 后者是安全对照与防回归，不是新增现存缺陷。这些是确定样本上的纯函数语义测试，不是完整端到端数据流覆盖，也不宣称一般语义蕴含校验已经有现成实现。

测试不会把“所有结论都拒绝”“只删结论关键词”“有任意材料就全部放行”“只要出现证据不足就全部放行”当成合格修复。没有固定要求新 violation code 或新接口，留给主线决定通用数据流设计。

## 最小通用修复方向（未实施）

- 把本轮明确提供的材料以 task/run 绑定的可追溯来源传入并保留到 GROUND；材料仅支持“材料记载/基于材料分析”，不自动证明现实真实性或执行成功。
- 区分评审判断、材料归引、外部事实、执行声明，按具体 claim 的支持范围检查，不能只靠有无一条 evidence、标题标点或全文拒绝词。
- 若进行纠正轮，提供具体缺证/矛盾 claim 与可用来源边界，保持现有副作用及完成契约门禁；不能靠重跑工具取代已有题面。
- 后续数据流修复需另补 executor 级测试，验证题面来源从输入到 GROUND 不丢失；本次不预造尚未设计的材料接口。
- 后续若需定位真实输出触发词，应在独立 QA 下显式采集按 run/round 绑定的候选及验证快照；目前不抓运行中应用、不伪造历史候选。

## GitNexus 与覆盖 hash

沿用 gitnexus-debugging skill：query 因 FTS 扩展缺失降级；context 定位 verifyClaims/runGroundAndPersist，epistemic=lower-bound；process 资源以名称成功返回 runGroundAndPersist → mergeToolResultsIntoLedgers → createEvidenceLedger（用 process id 查询未找到）。当前源码手工核对补足导航，未把旧索引行号或零结果当作安全证明。

本轮不修改任何已有函数/类/方法，只新增独立测试回调及报告，不涉及生产符号变更 impact；主线修生产符号前仍需重新 impact，未知范围不是低风险证明。

SHA256（收尾读取，与前次诊断五份源码一致）：

| 文件 | SHA256 |
|---|---|
| src/lib/agent-grounding-state.ts | d96ddf6b8cf003606251078c971348c3c144300ca1f66f54877defffdb3a56fd |
| src/lib/agent-grounding-ledger.ts | ddada8d232206feca7d0b177fc5bfe4e36eabe5f64e537742a10babd541eb4ef |
| src/lib/agent-run-executor/phases-ground-persist.ts | 8090e96c6c8c9b0c7df15c49dd26d91328967e9a0eeb9d3f4e19ea2a96b62d79 |
| src/lib/agent-run-executor/phases-model-tool.ts | 40bb73aa4cc9d0305fdb509ccf3bfda00c8a0a573f545f6b9867a5c999b4c75d |
| src/lib/expert-task-runtime.ts | 07f1e01bbe2b04775d7d4c34fc7d5d871e7fdad119b4e4cad8cb76a8cac2cef1 |
| tests/rqa12-provided-material-claims.test.js | 10d54bc22df66494210d216cc8280b445dc3b64ae848d83bf14eb9c11b825b44 |

本轮保留红测交接主线；未实施修复，不能报告生产门禁已通过。

