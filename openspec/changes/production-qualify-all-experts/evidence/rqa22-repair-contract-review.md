# RQA22：有证据绑定的最小修复输入契约

2026-09-06，只读设计复核。仅新增本报告；未修改源码/测试，未执行应用工具、模型、QA、测试或fullcheck。本文不提出专家ID/关键词豁免，不冻结数字，不改变verifyClaims或gate判定语义。

## 当前链路确认

- `src/lib/agent-run-executor/phases-ground-persist.ts:77`先postProcess，`:92`验证ctxBundle中的当前task/run材料，`:128`验证此刻fullText，`:137`独立验执行契约；`:162`仍只调用 `finalizeResponse('grounding')`。应传递的是**实际被检查的fullText**，不是更早MODEL文本、闭包lastModelText或最终拒绝文。
- `src/lib/agent-run-executor/phases-model-tool.ts:295`的闭包签名仍为 `async(reason)`；`:309`从apiMessages追加通用收敛指令，未携带被拒正文/具体问题。普通无工具终稿路径不把该正文追加到apiMessages。GROUND调用发生在该loop返回以后，闭包文本尤其不能替代GROUND的postProcess后候选。
- `completeWithinBudget`（同文件`:157`）调用 `fitToolRoundRequest(request,{currentInput,protectedToolCallIds,instructions,tokenEstimator})`；后者在 `round-context.ts:35`—`:59`单独预留受限数据的token与消息开销，先fitConversation，再插入完整user-role数据块。这是可复用的原子预算接口，**不是新增授权通道**。
- `llm-runtime.ts:293`的fitConversation保留原currentInput对象锚点，但预算不足时仍可截断其后的普通消息正文。仅append repair消息或标 `_contextCritical` 并不足以保证其完整；该标记不能作为user数据的通用防截断保证。
- `phases-model-tool.ts:317` finalizer无tools、单次、grounding输出2400并钳模型cap，二次length/tool-call输出被拒。`agent-run-kernel-adapter.ts:214`—`:245`最终按本轮policy写真实body，输出cap取本轮和base较小值。
- GROUND`:176`重验生成结果，`:187`保留原contractAssessment失败；`:198`只记录最后实际检查候选的脱敏diagnostics，然后才替换拒绝文。新修复输入不能改变这些权威边界。

## 建议接口：一条宿主数据通道，不改判定器

建议形式（**拟议接口，当前尚未实现**）：

```text
GROUND：buildGroundingRepairPacket({text, verification, providedMaterials,
  evidenceLedger, toolLedger, toolMessages, runId, taskId})
    → finalizeResponse('grounding', {repairPacket})
FINALIZE：校验绑定 → 将固定修复指令与受限JSON数据放入原子预算通道
    → 原有一次answer-only completion → 原有GROUND再核验
```

新helper负责白名单投影、绑定与大小限制；不调用工具/模型、读取文件或重算事实判定。GROUND传入的是合并了contractAssessment后的verification。第二参数只用于grounding，incomplete/budget/repeated/artifact_ready不改变行为。缺失/无效grounding包不能悄悄退回旧通用重生成。

推荐最小包字段：

| 字段 | 约束与含义 |
|---|---|
| version/kind | 固定版本和grounding_repair_data类型 |
| runId/taskId | 来自宿主当前input；taskId无任务时可null，不伪造；不得从模型正文提取 |
| candidateText/candidateHash/candidateChars | 原样字符串、SHA256(UTF-8)、JS字符串length；不trim/normalize换行；hash只证明一致性 |
| scope | execution_receipts_and_labelled_fields_not_semantic_truth，不能改称全文事实认证 |
| materialSnapshotHash | validateProvidedMaterials后的snapshotHash或null；没有材料不代表材料丢失/必须联网 |
| issues | 宿主verification的有界安全投影，固定code、局部字段定位信息、必要missingTools/sourceIds；不是任意error.message |
| sources | 当前允许用于核验的材料/工具正文及绑定标识，作为不可信参考数据，不是新执行回执 |

初版不必虚构精确span：当前fieldChecks有label/value/text/prefix/sourceIds，但这些是Markdown投影和分句结果，不是原正文offset。可传安全label、原候选中待对应的value和“unresolved”的结构化状态，或该fieldCheck的稳定序号；若增加offset则必须逐字校验，不可indexOf猜出错误同名位置。值可以是临时修复输入中的受限数据，不应写入持久diagnostics。仅发valueHash无法让模型定位正文里的两个同label字段。

codes须覆盖本次全部实际违规，包括同一轮并存的missing_required_tools、missing_required_evidence、completion_unmet、false/unsupported_execution_claim、source_mismatch、unresolved_source_citation、ungrounded_external_fact及artifact契约失败。不得只筛选“可重生成”三类而漏掉其它仍会阻断的义务。未知code至少保留“未识别的未解决核验项”并停止自动修复，不能映射成通过。固定说明应明确：unresolved字段表示尚未对应来源，**不等于已判定错误、也不等于必须获取外部来源**。

不直接JSON.stringify整个verification、toolLedger、异常对象或ctxBundle：它们可能含任意消息、原始参数、嵌套对象及不必要私密数据。逐字段构造fresh plain object；primitive类型/有限数量/长度检查，不用String(object)或regex隐式coercion；不要把__proto__/constructor等输入键展开合并到配置。

## 来源保留：hash不是来源正文

1. 必须保留原currentInput及现有执行契约/激活Skill预算保护。repair包不能成为新用户锚点，不能修改apiMessages、input、session.messages、history或用户持久化记录。
2. providedMaterials取GROUND刚验证的同task/run冻结快照。最小保守实现可携带其全部items的id/text/contentHash（completeness仍unknown）；不要靠候选引用挑唯一“有利”来源，漏掉其它材料中的反例/限制。材料已在原锚点完整出现时可验证后去重，但仅hash相同不能替代provider最终消息中实际可用的文本。
3. 工具来源的适用规则以当前 `agent-grounding-ledger.ts:395`附近materialSources为准：成功、非discovery、相应toolCallId/toolName绑定；完整正文来自匹配的done toolMessage，若本来只有digest就只能声明digest范围。源身份alias仅在actual/expected精确相等时成立。不能把失败/旧run/未匹配toolMessage或任意API消息当来源。
4. 现有校验器还接受成功的legacy user evidence digest，不应因新packet忽略这一实际支持通道；来源类型要明示，不伪造成当前providedMaterials或工具完成证据。
5. 不重建第二套更宽的source授权逻辑。若工具型来源完整保留尚不能安全接线，初版对该repair显式失败关闭，不能少带来源继续重写。优先复用同一已有来源投影语义；仅提取内部helper时需另做impact，不属于新增semantic exemption。

同run绑定应由调用链和fresh对象保证，再用hash防误配；自行构造一份hash正确的包不是授权凭证。finalizer校验包的run/task与闭包input相符；有providedMaterials时再校验相同snapshot，正文hash重新计算。不从磁盘旧diagnostics或用户payload接收包。不要拿finalizer闭包的旧fullText去要求等于postProcess后正文，否则会拒绝正确GROUND包。

## 预算与失败关闭

- 包必须有明确admission上限，和模型token预算分开。例如供主线选择的首版保守值：candidate UTF-8≤64KiB、issues≤32、总定位字段≤64、单value≤2KiB、sources≤32、序列化总包≤256KiB；ID≤256、安全label≤24。**这些是建议配置，非现有常量或专业评分标准**。超限拒绝本次自动修复，不能slice候选/来源或悄悄丢后半问题。source的既有32项/1MiB材料上限不是“必定能装进模型”的保证。
- 将固定修复指令和完整包作为request-local restricted instructions传给现有fitToolRoundRequest；与合同/Skill一起计入dataTokens和framing，保留原currentInput引用。不要把数据提到system角色，也不要借此增大inputBudget、挪用输出cap或覆盖既有保护页。
- `completeWithinBudget`目前没有独立repair参数，应显式消费request-local数据再调用ports.llm.complete，避免把内部包对象透传成provider未知字段。最终body应只含正常messages、原有policy与无tools字段；所有需要修复参考的正文确实在预算后的messages里。
- 若完整包+来源+原委托+必要合同/Skill超过预算，返回安全 `grounding_repair_budget_exceeded` 一类以budget_exceeded结尾的结构化错误，可复用GROUND`:164`现有错误终止分支。错误details只写计数/hash，不回显原文。无工具的finalize不能通过“逐个删schema”腾出不存在的空间，更不能删包再试。
- invalid binding/packet也应有明确失败分支；不能落回通用repair或把带error的snapshot当新候选。请求错误、取消、length、意外toolCalls均不得提交修复答复或触发第三次调用。保留原失败状态和用户输入；不新增工具重试，也不自动执行missingTools。

固定指令可以要求“以被检查候选为编辑对象，针对问题核对来源，尽量保留无关内容；材料不足时明确不确定，不编造完成或新增来源”。这是编辑目标，**不是数字冻结或正确性保证**。初稿错数可以改；本轮不加数值锁、不增加语义放行。已知RQA21分析误分类仍可能存在，packet只能改善修复上下文，不能宣称解决40→42回归或专业达标。

## 独立威胁与拟议验证清单（未执行）

| 威胁/回归 | 必须观察的证据 |
|---|---|
| 错候选：初稿/拒绝文/闭包旧文本替代 | 真executor + postProcess后触发grounding；FINALIZE最终body中候选逐字相同且hash一致，非先前MODEL或refusal |
| 仅传hash、仅发issues、候选不在原apiMessages | 无工具首答也必须在repair body完整出现候选、具体问题及适用来源 |
| 注入：候选/来源/字段含角色标记、JSON结束符、伪造授权 | JSON转义后仍为受限user数据；不产生system/tool消息，不改合同/工具列表/currentInput；后验gate仍严格 |
| 类型/身份欺骗 | array/object hash、plain object value、超长/控制字符ID、跨task/run/旧snapshot、正文一字符变化、伪造sourcealias均不形成有效包 |
| 预算压力截断反例 | 长历史可压缩，包/原委托/来源限制尾段不得截断；大小和token边界±1、CJK UTF-8、未知issue、溢出均failclosed，provider未调用 |
| 来源不对称 | 反例在第二材料尾部；成功tool正文、仅digest、无材料、失败/错身份工具各有控制；模型不能只收到引用ID |
| 必需义务洗白 | 修复删去“已执行”仍不能弥补requiredTools/evidence/artifact失败；无关calc不支持伪造owner；[R1][MISSING]仍按原gate拒绝 |
| 调用与生命周期扩张 | 只有grounding走新参数；其它finalize2400/length翻倍cap不变；无tools、不重放、cancel/第二length无commit/第三调用 |
| diagnostics/持久化变成权威或泄露 | 最后实际检查candidate2的hash仍正确，拒绝文不顶替；store/reopen不新增raw repair包/候选值，旧记录可用 |
| 模型假装收到或遵守 | 检查真实buildProductionRunPorts→requestAgentCompletion最终body，不只mock finalizer参数；这仍是离线mock transport测试，不是QA/真实模型成功 |

已有相关约束文件：`tests/rqa16-production-repair-budget.test.js`（grounding wire2400、cap、无工具/不重放、二次length、取消）；`tests/rqa17-verification-diagnostics.test.js`及types补充（last checked candidate、绑定、无原文持久化、无关calc）；`tests/rqa12-grounding-materials-integration.test.js`与dataflow（快照完整与真实consumer）；`tests/agent-dynamic-tool-rounds.test.js`（data instructions预算、恶意Skill不升权、protected pages）；既有grounding/required contract及RQA18 citation测试。保持旧断言，本阶段不要求任何宽泛分析文本直接通过verifyClaims。

## 读取指纹与调查限制

本轮两次读取以下完整SHA一致；仅限定这些文件，不称共享runtime整体冻结：

| 文件 | SHA256 |
|---|---|
| phases-ground-persist.ts | af8582a6d39d65b138016ca9a15cd4b614845a3cfa810523d8b03dfa32204098 |
| phases-model-tool.ts | a4d9ebb23857232e8fbd25a864ef823a0ca255ec54de8926613791d80f060413 |
| round-context.ts | b9358c65d6d13fbac88da418638ff300d74df447ba3b162c2c1c59c3f41a0a79 |
| llm-runtime.ts | f7620abf0caa17865e2bd98ded8cf421096c537af2b80237bb6fdc7781a82eda |
| agent-grounding-ledger.ts | 47cfa41709027adcf1652de22b145995e24ccdfda2312d397c4bafa3d24697f1 |
| agent-run-kernel-adapter.ts | 365c148c17fed946c3ced093257d12a41f975065b57d67c43cc791bfb679709a |

当前model-loop已包含RQA21末尾建议的initialToolSurface可选链；只观察到源码，不声称已复跑绿。GitNexus技能已全文读取，query仍FTS降级无匹配；context(finalizeResponse)给出GROUND和MODEL两个入口但lower-bound且无process，故以当前源码确认接口。未重建索引/触网，无生产符号修改；实现前impact由主线负责。报告不扩大为全系统认证，也不改变历史QA或评分结果。

## 追加：四文件落地后 P1 只读复核

**结论：在本轮实际调用路径和下列源码快照中，未发现可确认的新增P1。** 这不是全系统安全认证或绿测确认。只读了四个目标文件及既有预算接口/台账构造的必要上下文，未修改源码、测试，未运行测试、模型或QA。主线此前63项绿为主线结果，不算本代理独立验证结果。

### 已核对的关键边界

1. **候选与同轮来源实接线。** `phases-ground-persist.ts:162`传入postProcess后、刚经verifyClaims检查的fullText、合并契约失败后的verification，以及同一个validated providedMaterials、重建evidenceLedger和toolMessages。`phases-model-tool.ts:327`在闭包内调用builder，并在spread之后写入宿主input.runId/taskId，repairInput不能覆盖身份。不是把更早loop候选或拒绝文当原稿。
2. **来源提取等价。** `agent-grounding-ledger.ts:319`的collectGroundingSources保留提取前已有逻辑：providedMaterials项；成功user digest；成功且非discovery的tool来源；精确toolCallId/toolName对应done消息的全文，否则digest；toolSourceContent解析；actual/expected同key精确相等才给alias。`:418`的verifyClaims与repair builder共同调用。额外createEvidenceLedger只是浅复制entries数组，未改entry或过滤判断。没有增加来源种类、把失败回执当成功，或把一般来源片段变成执行证据。此项为与上一轮已读代码逐分支比较，不冒充从历史完整文件hash重建证明。
3. **原始不可信数据不升权。** `agent-grounding-repair.ts:13`—`:44`只投影正文、来源、issue code/字段，不传任意exception.message或原始工具参数；JSON.stringify转义，固定kind/trust/scope；metrics仅hash和数量。固定修复指令与数据均为user-role受限输入，未并入系统消息、授权配置、ledger或持久session消息。hash由实际候选重算，不相信候选里自称的hash。
4. **预算原子性。** `phases-model-tool.ts:158`把additionalInstructions加入既有fitToolRoundRequest的保留数据；grounding不append普通易裁剪消息，也不改变currentInput或apiMessages。固定指令与完整包共同预留token/framing，128KiB序列化总量超限明确返回grounding_repair_context_budget_exceeded；预算不足沿GROUND已有budget_exceeded终止分支，未观察到删包/截断来源后继续调用。此处既有预算实现只读确认，不等于验证真实provider tokenizer精度。
5. **后验权威未变化。** 包仅用于answer-only生成；生成后仍verifyClaims相同材料/消息并附加原contractAssessment失败，requiredTools/evidence/artifact不由改写消除。finalize仍一次、无tools、原输出cap和length/tool-call拒绝逻辑保留。最后检查候选的verificationDiagnostics仍在拒绝替换前构造。没有数值冻结、分析豁免或“packet存在即验证通过”。

### malformed data：按可达路径，而非外部API假设

builder直接被任意调用时确实较宽松：text/field.value用String转换，verification缺失会成为空列表，包没有独立外部schema校验。但是实际新增入口只有GROUND→finalizeResponse→builder：GROUND已成功用fullText执行真实checker，fieldChecks的label/value由checker生成，违规code由checker/contractAssessment生成；来源为验证后的快照和当前合并台账。toolMessages在之前merge和verify阶段已经作为数组遍历。这个入口**不接收用户/模型提供的repairPacket或外部verification对象**。

因此，单独调用builder({text:{...}})或finalizeResponse('grounding')不带第二参数，不足以构成当前生产路径P1；未发现需要为此扩展公开API校验层的真实caller。未来若暴露该helper为外部输入，应重新审查，但不是本轮范围。用户可控的原稿、材料、字段值仍是不可信字符串，经JSON数据通道处理；不能据此宣称模型绝不受注入影响，实际防线仍是工具禁止与后验gate。

### 非阻断残余与最小验证建议

- 包同时保留materials和包含同批材料的sources，工具alias也可能重复全文；这会更早触发128KiB/输入token上限，属于保守拒绝/可用性代价，不是放行漏洞。若后续去重，必须按内容与来源身份保留引用映射，不能简单删掉sources。
- issues保留code，但未完整复制unmet明细；现有合同保留通道及后验contractAssessment仍在，未发现可因此误通过。分析分类/算术正确性仍属原有边界，本次不扩大。
- 建议主线当前测试优先锁定“成功工具全文+精确alias与gate投影一致”和“source尾部反例/总包过大在最终body前failclosed”；并保留已有postProcess候选、requiredTools未满足、最后候选diagnostics控制。不要求新增大型架构，也不以此要求本代理继续修改或执行测试。

### 此次精确指纹

两次读取四文件完整SHA256一致；只证明此次有限读取窗口：

| 文件 | SHA256 |
|---|---|
| src/lib/agent-grounding-repair.ts | c1375979cd722b6e298d971068c1d22b0147dd0f7a0c5a0453cdfb6cacde58c2 |
| src/lib/agent-grounding-ledger.ts | 04043928c418cf186adb07e0efa9f5de646cfff9b204a314cb51ee49a01d91c9 |
| src/lib/agent-run-executor/phases-ground-persist.ts | b90d266470ce60e8d5654721f7dcd57b245297efa0d8149694c160da47059c17 |
| src/lib/agent-run-executor/phases-model-tool.ts | d7f91370ceb1f5f8b26a194df1786d825b4857b9474211503c36dcd0bbfc7e21 |

GitNexus query仍FTS降级，context(runGroundAndPersist)为lower-bound；实际路径以当前源码补充，不能把缺边视为无风险。原设计章节及历史指纹保持原样，不以当前实现反写历史。

### 收尾：builder 标签局部变更复核

只读确认当前agent-grounding-repair.ts SHA256为 `70993b8ddd6557e07c463e184028544ccc0c1410a819c32fd7989452e9bcc6b7`。仅在内存将新增标签注释/逐项flatMap+Set代码还原为上一版 `claimLabels: getViolationClaimLabels(issue),`，整文件重算恰为此前已审 `c1375979cd722b6e298d971068c1d22b0147dd0f7a0c5a0453cdfb6cacde58c2`；未回写源码。这证实相对此前快照只有该局部变化。

逐标签调用仍执行primitive string、Unicode字母/数字/空格/连字符及1—24字符校验；Set去重并保留首次顺序。它避免将UI的整体8标签/前32项限制带入repair，未扩大单标签许可字符或把非法标签截短后接受。整体JSON仍受128KiB拒绝上限，不会因保留更多标签而静默裁剪包。此局部变更未发现新增P1，维持上一复核结论；未运行测试或拓展其它代码审查。

主线报告39项新测试+69项相关测试绿、fullcheck94032 exit0，属于主线执行证据。本次fresh QA DA首答通过、数值40正确但未进入FINALIZE，**不能验证repair路径或证明修复过程不会数值回归**。不修改历史审查、评分或QA结果。
