# AO/RR 独立旧新对照 — 2026-09-06

范围：冻结题面下四题、两配置；逐断言评分及额外事实检查已经落盘于 iteration-1/{AO01,AO02,RR01,RR02}/{old_skill,with_skill}/grading.json。未修改方法、原始输出或断言。

| 题目 | old | candidate | 专业硬伤（不被局部分数掩盖） |
|---|---|---|---|
| AO01 | 5/5 | 5/5 | 新版尾部把周敏写成王敏；五项局部断言漏检全篇姓名一致性。旧版未发现确定硬伤。 |
| AO02 | 3/5 | 5/5 | 旧版把缺少证明写成未完成，并新增未标为建议的补交义务；新版未发现确定硬伤。 |
| RR01 | N/A | N/A | 同 run 仅剩平台拒绝替换文，原候选不可恢复，不对拒绝文打专业分。 |
| RR02 | N/A | 3/5 | 新版性能验收缺规模和计时起止；尾注将已规定的 R1 验收附加为 R2 批准后才生效。 |

全篇混合计数：AO01 旧336/新277；AO02 旧142/新144；RR02 新219，均未超各题上限。口径为每个汉字一项、连续拉丁字母/数字词一项（含词内小数点、逗号、斜线），计入标题、表格及尾注，忽略标点/空白/Markdown 控制符；原始字符数另存 grading。N/A 不计为0分、不参与分数聚合。

## 新 RR01 exact same-run 证据

证据文件：[live.json](iteration-1/RR01/with_skill/live.json)、[transcript.json](iteration-1/RR01/with_skill/transcript.json)、[grading.json](iteration-1/RR01/with_skill/grading.json)。结构化路径为 live.task.executionEvidence[0]，不是从拒绝文案或相近时间推断：

- taskId：task-mtowzdmo-c9tm5。
- task.execRef.id = session.id：wb-expert-task-mtowzdmo-c9tm5；session.taskRef.id 同 taskId。
- runId：expert_task-mtowzdmo-c9tm5_mtowzdzz。
- deliverableId：output-1；gateStatus：blocked；verificationPassed：false。
- toolCalls=[]；evidence=[]；createdAt=2026-09-05T21:48:32.935Z。

同一 executionEvidence 的 violations 原值：

```json
[
  {"code":"false_execution_claim","message":"执行态声明无 ToolLedger 支撑","missingTools":[]},
  {"code":"unsupported_execution_claim","message":"删除声明没有对应的成功工具证据","missingTools":[]},
  {"code":"ungrounded_external_fact","message":"具体事实没有正文或权威数据证据支撑","missingTools":[]}
]
```

同 run assistant 仅剩“工具已返回结果，但回复中的部分完成声明缺少对应操作凭据，尚不能确认这些操作已完成。已返回的成果和执行记录已保留。”，answerHash=ba1ba64997883489。这条通用替换文不证明实际调用过工具：同 run 记录为零工具。checkpoint、terminal events 及 session artifacts 均未提供被替换的候选全文。**不能恢复触发句，不能据 violation 推定真实删除、推定模型原文措辞，亦不能确定误判机制。** 其中“删除声明”是校验器记录的分类，不是评分员对缺失原文的判断。

同 run contextAudit：skillRefs=["requirement-review"]；skill.explicit-content hash=7df874bae6857343，chars=1024，truncated=false。任务状态 needs_input；executor terminal 的 completed/ok 不等于任务门禁或专业通过。

旧 RR01/旧 RR02 仅记录 ungrounded_external_fact；不要把新版三类 violation 回填到旧 run。

## 解释边界与检验缺口

- 候选为专家/SOP/方法/requiredSkills 的整包变化。旧 skillRefs=[]，新版有显式方法内容；不是纯 Skill 因果实验。
- 新 RR02 交付成功不代表通用 claim gate 修好；它仍只有3/5且有额外专业问题。
- 五断言没有穷尽全篇姓名、建议中的无据理由、尾注新增前提；需要结合 grading.claims，不能只比较通过率。
- 已对8份记录核验 task/session/run、冻结断言、原文及同 run 上下文；12份旧版 live/transcript/answer 原始文件核验未变。未补造时间或成本。

provided-materials 后续代码审查是另一项工程评审，不改写上述历史评分，也不用于猜测已经丢失的候选原文。

## provided-materials 数据链只读初审（同日追加）

这是落地中的工作区快照审查，不是冻结最终版验收。阅读了 RQA12 诊断报告、三份原有/独立 claim 测试、新 dataflow/integration 测试及相关源码。GitNexus query 的 FTS 降级，context 为 lower-bound；读取 RunGroundAndPersist → CreateEvidenceLedger process 后以当前源码补足导航。未编辑 src/tests，未调用模型/API、真实用户数据或 fullcheck。

### 已核对的数据流与边界

`task.brief.materials → runtime 创建本轮快照 → prepare 校验 → execute 使用 prepared 快照 → production ports context → executor ctxBundle → GROUND/FINALIZE 校验`

- expert-task-runtime.ts:520 仅使用当前执行任务的 brief.materials；每轮新 runId，未从 SOP、混合 prompt、旧 assistant 或旧成果回填。provided-materials.ts 创建新冻结副本，核验 task/run、内容及快照 SHA256，拒绝重复 ID/越界/篡改；忽略图片及仅有链接/标题的非正文。hash 证明内容一致，不证明来源权威。
- agent-generate-prepare.ts:115 在设置读取前校验；agent-generate-execute.ts:84、178 向 context 和 executor 传递 prepared.providedMaterials，不让原 payload 覆盖校验结果。
- agent-run-kernel-adapter.ts:61、209 对 adapter 身份及 context.build 调用身份再次核验。phases-ground-persist.ts:86、132、167 使用同一 current-run 快照作首轮及纠正轮字段校验。
- 快照不写入 ToolLedger/EvidenceLedger；requiredTools、requiredEvidence、completionConditions 及独立 validateExecutionCompletion 仍在，纠正措辞不能补出工具回执。缺省快照为 null，是旧调用兼容，不意味着混合 prompt 可以当来源。

### 定向执行：13 项，12 pass / 1 fail，exit 1

命令：`node -r ./scripts/register-ts.js --test tests/rqa12-provided-materials-dataflow.test.js tests/rqa12-grounding-materials-integration.test.js`。

dataflow 的8项通过；integration 的5项中4通过。唯一红项为 integration:42 的 `mixed prompt/SOP text is not implicitly converted into provided evidence`，期望 blocked，实际 verified。

**已复核是该测试的纠正轮夹具不充分，不能据此指控 SOP 泄漏：** tests fixture 只提供一轮“负责人：不可信系统姓名。”；agent-run-ports.ts:173—175 在脚本耗尽后返回“已整理最终答复。”。只读内联探针分别使用一轮及两轮相同无据姓名，结果为：

```json
{"repeat":false,"text":"已整理最终答复。","gateStatus":"verified","violations":[]}
{"repeat":true,"text":"当前缺少可验证的来源证据，不能确认回复中的具体事实。需要先获取相应来源。","gateStatus":"blocked","violation":"ungrounded_external_fact"}
```

最小测试建议：让首轮及 FINALIZE 都提供同一无据声明，再断言最终 blocked，并检查没有 material/执行证据混入。不要为消除此红测而放宽或加严生产 gate。原测试未被本审查修改。

### 尚不能宣称完整覆盖的部分

1. **既有入口截断**：workbench-task-store.ts:103—122 将每份 content trim/slice 到8000字符、材料至多32份；reviewMaterials 也限8000。新 helper 的长文本/1MiB测试是 helper 边界，不是用户提交到存储的全文保真测试。completeness=unknown 是正确保守标记；若产品要承诺全文，需另行处理存储入口及上下文预算，不能将本轮实现称作已完成全文贯通。
2. **测试链条是分段接合**：真实 runtime 测试截获 generate payload；真实 prepare 只测拒绝路径；execute 集成测替换了 prepare/tool-surface；GROUND 测试使用 mock ports。建议补一个无外网的合法 prepare→实际 context packing→kernel 组合测试，比较进入模型的材料范围与快照，并验证长材料尾部没有被默默当作模型已读。
3. **生命周期组合缺口**：helper 两 run 哈希不同已测，但还需实际任务 provideInput 排队→下一轮、修改/重试→新 run 的内容与 hash 绑定，确认旧快照不随旧 session/checkpoint 复用；此处源码路径每次 execute 重建，尚未用组合测试宣称全部生命周期通过。
4. **持久化审计仍不足**：当前 executionEvidence 映射仅保留 violation code/message/missingTools，未保留 fieldChecks 的来源 ID/字段值或 snapshotHash；被拒绝候选仍在 canonical 持久化前被替换。新数据链不会自动恢复历史 RR01。建议另行授权最小 run/round 绑定的材料摘要审计（ID/hash/长度/完整性、claim位置及校验结果），避免默认记录全文或向用户泄漏敏感材料。
5. **字段校验不是通用语义验真**：当前 agent-claim-source-check.ts 仍有 source ID substring 匹配及建议/Markdown等有限识别；agent-grounding-ledger.ts 仍可由任意成功非 discovery 工具证据跳过 unresolved 字段。独立 tests/rqa12-claim-source-review.test.js 已定义相关反例，非本数据链新增发现，不能因这里的12绿宣称这些问题关闭。FINALIZE 指令也仍为通用指令，未接入具体违规 claim/source。

结论：所读快照的分离来源、身份绑定、两次校验及显式契约保留方向成立；未发现证据表明本轮把 SOP 直接塞入 providedMaterials。仍需修正上述红测夹具并完成最终版定向复验；全文、生命周期组合、可追溯审计及语义校验边界应分别跟踪，不混为已达标。

### 本次测试前后相同的 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/provided-materials.ts | A7C9842B41387A3E47EB2E2DA5F4AF46806A73CDB62246EA96328DDC006C14F7 |
| src/lib/expert-task-runtime.ts | 48BF68BE9EA5D6641CF3C7E476B5CECC3903FE3EAE5E097C49C5BD5807BFB05E |
| src/lib/agent-generate-prepare.ts | 4F28B4AD9717C836B60539D742DB90DE3ED03160AB37000BCDF38DCB0DBD54F6 |
| src/lib/agent-generate-execute.ts | EF1A2F021FC5D395518F0A273A721ACB76F934EDFF14E9600B34DC18590D0DDE |
| src/lib/agent-run-kernel-adapter.ts | BCFA56EEABBAE0A2B4BF8DA815503F1C2646E804AE0011D788D16BA247B2B50D |
| src/lib/agent-run-executor/phases-ground-persist.ts | BF02C15BDA6C32417BA3281AAB7DDEF1D01A15A21D04C1A4C9B1C4DBEE912B40 |
| tests/rqa12-provided-materials-dataflow.test.js | F3FA5492472704811E1AA13A5C1676DAA9C0D291AF309A4D25210D1B293C9C48 |
| tests/rqa12-grounding-materials-integration.test.js | 128E80EDE03C5C552E4553D08FD616E6B3D72925E0E4513D66E839E509DE3A68 |
