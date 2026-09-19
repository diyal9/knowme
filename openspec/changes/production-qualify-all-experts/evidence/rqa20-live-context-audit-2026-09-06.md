# RQA20 新旧真实运行：同 run 方法上下文审计

2026-09-06。独立只读核查；本轮只新增本报告，无生产/测试/包/原始证据/评分修改，无 API、模型调用、任务 retry 或 QA 重启。仅读取本 change 保存证据、指定隔离 QA 的精确 run 与三个已安装核心 SKILL.md，未访问用户 APPDATA。

## 结论及证据强度

**新6/6 的核心方法进入了同 run 记录的最终装配上下文，6/6 未截断。** 不只核对 requiredSkills：逐题完成 task→session→state/checkpoint→实际 llm-system-prompt 的绑定，并将隔离安装全文重建的块长度/hash 对上真实 manifest。旧6/6 无显式 L1，详见同目录 `rqa20-old-context-audit-2026-09-06.md`。

此处“实际加载”指宿主当轮装配日志中的 included 内容，不是独立网络抓包。未取得完整 HTTP 请求体/provider 收包内容，不能声称逐字证明 provider 接收，也不能把加载成功当成模型遵循、专业通过或纯 Skill 因果。DA-N01 的 FINALIZE 没有独立完整上下文记录。

新旧六题的 inputs[].input 字符串及 inputHash 逐题完全相等；新包同时改变 SOP、依赖/路由和权限表达，且旧/新实际工具面不同，属于整包配置对照。

## 来源和精确绑定

- 证据前缀：`D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/`。
- `rqa20-new-live.json` SHA256：`AC0890D3143AAAFDF82B8775474590F0703B7989C75F596CDE72101BB847C3EF`，phase=candidate-installed-2.1.0，capturedAt=2026-09-06T04:25:24.975Z。
- `rqa20-old-live.json` SHA256：`D2120A2F1013E36E9780C62EA3BF67C61B052BD91CCC171D46D44BF43B5D24F7`。
- 隔离根：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`。
- 实际日志：隔离根下 `logs/knowme-2026-09-06.jsonl`；精确状态/检查点为 `agent-runs/<runId>/state.json`、`checkpoints/latest.json`。以下每个 run 均有一条 llm-system-prompt。表中时间为 UTC。

| 案例 | taskId | runId | 日志行 / 时间 | task 状态 |
|---|---|---|---|---|
| R20-CS-N01 | task-mtpaz9ca-9fkzd | expert_task-mtpaz9ca-9fkzd_mtpazckh | 537 / 04:20:00.511Z | review |
| R20-CS-H02 | task-mtpazete-hgu70 | expert_task-mtpazete-hgu70_mtpazh8g | 539 / 04:20:06.542Z | review |
| R20-CD-N01 | task-mtpazjhg-5fq64 | expert_task-mtpazjhg-5fq64_mtpazmjq | 541 / 04:20:13.006Z | review |
| R20-CD-H02 | task-mtpb1w1s-2bozl | expert_task-mtpb1w1s-2bozl_mtpb1xdr | 549 / 04:21:59.482Z | needs_input |
| R20-DA-N01 | task-mtpb1ylk-lttbs | expert_task-mtpb1ylk-lttbs_mtpb2038 | 551 / 04:22:03.122Z | review |
| R20-DA-H02 | task-mtpb21er-w7xwl | expert_task-mtpb21er-w7xwl_mtpb22wv | 554 / 04:22:06.598Z | review |

完整 sessionId 均为 `wb-expert-` 加表中 taskId。逐题验证 task.executionEvidence[0].runId = state.runId = checkpoint.runId；task.execRef.id = rows.session.session.id = state.sessionId = checkpoint.data.sessionId。不依赖日志脱敏 sessionId 或并发完成先后猜配。

7 个 verifierCaptures 用 args.providedMaterials.runId/taskId 和 args.evidenceLedger.runId 精确归属，不按 captures 数组顺序配题：CS-N01 对应 index1、CS-H02 index2、CD-N01 index0、CD-H02 index5、DA-N01 index4/6、DA-H02 index3。六题最后一个 capture 的 text SHA256 和 material snapshotHash 均与任务 verificationDiagnostics 一致。capture 提供材料逐项 id/text 与对应冻结 payload.brief.materials 相符。

## 安装与 actual L1 完整性

保存的六次 installPrechecks、installResults 均 ok:true。三个核心版本1.0.0，三个专家 E/C/L 记录2.1.0；installed、assignment 与 session 技能绑定一致，session SOP 与保存 installed SOP 全文相等。三个专家 canonical 权限均 connectors.allowedConnectorIds=[]、tools.allowlist=[]、network/write/externalWrite=false。每个 default route 仅要求自身核心；六题自定义 primary.requiredSkills 也各只有自身核心。

DA 的 installResults 明确有两个 missing_optional_dependency warning：business-metrics-analysis、business-cause-analysis。它们不是必需核心；不能将“安装 ok”扩称所有辅助依赖齐备。新核心方法权限全关闭、dependencies=[]；本轮无动态工具需求。

| 专家两题 | 实际 skillRefs | 显式块 chars / 日志 hash | L0 chars / hash | SOP chars / hash |
|---|---|---|---|---|
| CS | [content-strategy-method] | 1162 / 6f99a76c4a3046c7 | 379 / 71f0e4e39553f7aa | 276 / cddb12e54561fd54 |
| CD | [creative-concept-method] | 1185 / 6f377a17857f10b5 | 564 / dc4a12e31576265b | 267 / eb39779915740731 |
| DA | [data-analysis-method] | 1358 / 0182b3392b9b2792 | 565 / d0f77382b1ad57d4 | 283 / 90e11fd3a9340e78 |

六 manifest 各16个 included 块，均含一个 skill.explicit-content 和一个 skill.auto-summary；omitted=[]、conflicts=[]。所列块均 truncated=false。显式块 projectedRole=user、sourceTrust=user，不能误称平台系统指令。只有核心进入显式 L1，辅助方法可能出现在 L0，不等于完全不在上下文。

全文核对从保存 installResults.installDir 指向的隔离路径读取 `capabilities/skills/<method>/SKILL.md`，不从 requiredSkills 或仓库源码 hash 推断。所用 parseSkillFrontmatter 导出函数指纹 `eb2cd9bfbba1d8a65d7fdb6d24b4b98646b2fa7f0de2882a98a53518fbe839c7` 与保存 QA 指纹相同。用 `# 技能 <parsed.name>\n<完整 parsed.body>` 重建，再移除唯一末尾换行；其长度及 SHA256 前16位分别匹配表中真实日志。原样未去尾块各多1字符，整段 body.trim 则各少1字符；没有静默删除正文。

| 核心 | 隔离 SKILL.md 原始 SHA256 | parsed body chars | 重建显式块完整 SHA256 |
|---|---|---:|---|
| content-strategy-method | dce9667365d55853ab7a385de10fa338d282eac53050fa6e4426d170fba24d79 | 1134 | 6f99a76c4a3046c7b4576ff22fcb9144a15b169a5bd2a0c707da150037047e3c |
| creative-concept-method | acb33851a5f233f6fac2e04430726f2d060189a2775cb9cb405248859c564148 | 1157 | 6f377a17857f10b5c59b8a06ae5cd0441cd76ecea297d8ddab846d8ae14d4721 |
| data-analysis-method | c3a2650715fe87dca6a8fd139c61457b8ea8656ef9c5b3a3ed25589f349ecfc2 | 1333 | 0182b3392b9b2792b9bb4350b5ebbc1680aa34398def88804b8559ec0e161e0b |

日志只保存16位块 hash，报告中的完整块 SHA256 为独立重建值，不冒充 provider 回执。上述复核提供全文装配的交叉证据，仍不证明模型注意或采纳了方法。

## 模型策略、工具与最终化

六轮实际装配日志均 model=qwen3.8-flash、scene=expert-collaboration、phase=execution、executionPolicy=tools-allowed、locale=zh-CN、promptPackVersion=zh-CN@2、semanticSelection.mode=off。工具允许策略标签不等于本轮有工具：六轮 capabilityIds=['suggestion']，state.meta.metrics.toolSurface 均 available=0、loaded=0、loadedNames=[]、expansion=0；toolCalls=0，checkpoint.toolLedger.calls=[]，任务 executionEvidence.toolCalls=[]。

七个 observer args.taskFrame 均 requiredTools/requiredEvidence/completionConditions/requiredArtifacts=[]、minArtifacts=0。没有 calculate、load_skill 或外部工具实际调用；核心是预先装配进入上下文，不需要通过模型工具调用 load_skill 才算加载。新结果不能被解释为纯计算工具成功带来的提升。

- CS 两题、CD 两题、DA-H02：metrics.modelCompletions 为 MODEL/stop。
- DA-N01：MODEL/stop → FINALIZE/stop；不是 length 修复。index4 候选923字符，被标为 ungrounded_external_fact，字段为“结论：经理草稿不能作为立即全量回退的决策依据”；index6 候选934字符 passed，最后 task review。不能只读最终 pass 而隐藏中间平台干预。
- 六 state.status=done、terminal=true；CD-H02 task 却 needs_input、deliverables=[]。其 session.run.status 仍 active；不使用 kernel 或 session 摘要覆盖任务层状态。

没有保存可精确按 run 绑定的完整请求 body、temperature、max_tokens/max_completion_tokens 或模型实际请求 cap；state.budget={}、checkpoint.runtime.budget=null，usage 字段脱敏。相邻 llm-request/response 日志没有 runId，不能按时间相邻硬配并发请求；不从 token 数或当前磁盘 policy 推测本批预算。模型名称/finishReason/工具面以上述实际同 run 记录为限。

## CD-H02 citation 分类（不修复、不评分）

index5 observer 时间为 2026-09-06T04:22:16.965Z，providedMaterials 与 evidenceLedger 均绑定 `expert_task-mtpb1w1s-2bozl_mtpb1xdr`；材料 M1/M2/M3 与冻结输入相符。

其1260字符原始候选在版面表两处写 **“票号占位 [____]”**；结果明确为 `passed:false`、`claims:[]`、`fieldChecks:[]`、`unresolved_source_citation`、`missingSourceIds:['____']`。这不是缺少 M1/M2/M3、不是工具失败或 owner 字段缺证据。本次实际拦截可归类为**模板占位符被识别为来源引用**，而不是候选声称存在名为 ____ 的真实来源。

候选 SHA256：`0278d0b578a2db795144468cf2ca37ec13b2f5d8d155c8c9679df585920fa12c`；材料 snapshotHash：`3b788eb729caaebfe30c9252421470cf3799f0e0fb4f02ef68d958943ea45112`，均与 task diagnostics 对齐。kernel outputDiagnostics 最终提交49字符、hash `d7a71855077b585c`，是平台替换后的文本，不是这篇候选的 fingerprint。任务 attention 为 evidence_incomplete/retry，未验收成 review。

该分类不宣称候选正文专业合格：正文另有设计取舍理由、局部信息要求解释等应在专业评分时全文审查，不能因 citation 属占位符误判就豁免其他断言。此处不修 runtime、不变测试、不重跑模型。

## 进程一致性与不可扩大范围

old/new runtimeIdentity 均 PID13260、同隔离 userData。逐项比较四模块 exportFunctions 对象完全相等：agent-context-assembly、skill-runtime、research-routing、expert-task-runtime。关键保存指纹为 assembleCapabilityContext=`37ef3779d4c02b66f63e35bd31f7920b30196566ea78729600a5e1dd71818fa3`、createSkillRuntime=`7bcf9d7ddb03d930a35e72ff0ffe8531919ab39eb62a87d1764257d0d08b2877`。

但 old/new 捕获的磁盘 assembly 从 `73a617…` 变为 `9f8aeb…`，skill-runtime 从 `577225…` 变为 `066c1f…`。**磁盘 hash 不等于已加载模块 hash；四模块导出函数相等不证明传递依赖、闭包状态、设置、其他缓存或全进程冻结。** 不以当前磁盘 check 失败推断本批 L1，也不把同 PID 与该四模块指纹扩大为纯 Skill A/B 控制。

旧安装权限={}（legacy adapted），新安装显式全 false/空；新实际工具面为0，旧批存在工具尝试。上述整包和可用工具差异必须进入后续专业对照说明。到此完成上下文与平台处理审计，不为任一答案给专业分数。

## 追加交叉核验：DA-N01 修复过程的可确证数值漂移

只读复核 `rqa20-new-live.json` 的 verifierCaptures[4]、[6] 原文与 M2 表格，独立复算四行输入：原版 entered=200、completed=100，完成率50.00%；新版 entered=300、completed=120，完成率40.00%；新版减原版为 **-10.00 个百分点**。

两 capture 的 providedMaterials 全对象逐字序列化比较相等，均 task=`task-mtpb1ylk-lttbs`、run=`expert_task-mtpb1ylk-lttbs_mtpb2038`、snapshotHash=`88f42b5ff2890b14d0c78f9d54b99e7957603c3ff1a62cc2e6672c88f5bfd662`；不是换材料、跨 run 或另一次 retry。

| 阶段 / observer 时间（UTC） | 原文总体数字 | 实际 verifier 结果 |
|---|---|---|
| MODEL 后 index4 / 04:22:15.955Z | 新版120/300，40.00%，变化-10.00pp；正文亦写50.00%降至40.00% | passed=false；ungrounded_external_fact 命中分析判断“结论：经理草稿不能作为立即全量回退的决策依据” |
| FINALIZE 后 index6 / 04:22:25.075Z | 新版 **42.00% (120/300)**，变化 **-8.00pp**；正文也改为下降8个百分点 | passed=true；claims=[]、violations=[]、fieldChecks=[]；任务最终review |

index4：923字符，SHA256=`5ff7477d05efc6d5786a97e51647749674f61a4f147e5815a506966c36a45123`。index6：934字符，SHA256=`595aac49c228c86e5be86e007daaa66e31fa0686d7d80cba0a82c18886e11cd3`；后者与保存的任务 diagnostics 完全一致。两次 toolLedger.calls=[]、evidenceLedger.entries=[]、toolMessages=[]；此次独立复算是审计动作，**不是原任务计算工具回执**。

可确证的是：平台将上述分析判断归为无来源字段并触发 FINALIZE；修复生成把原来正确的40%/-10pp改成错误的42%/-8pp，gate仍通过。不是判定器直接执行了错误计算，也没有证据说模型初稿全文专业正确。初稿另有因果措辞、验证方案等需专业审查；本节只锁定这组数字由正确变错，不能用其给初稿整体背书。

verifier 声明的范围仍为 `execution_receipts_and_labelled_fields_not_semantic_truth`。此次 pass **没有验证算术、全文一致性或专业判断**；数值回归是模型修复过程产生且最终未被该 gate 检出的错误，不应被 task review 掩盖。本轮不修 runtime、不改冻结测试或原始输出。

## 追加：主线最终 check28046 的保存证据

已只读 `D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa20-check-28046.json`，文件SHA256=`10864ca6ea8d981ae8357de95b9eabc2d1b180bcbd7048bbd303e969b312be82`。这是主线运行的保存结果，非本代理重新运行：npm run check，2026-09-06T04:35:06.773Z—04:36:03.641Z，exit1；backend tests3068，**3010pass / 7fail / 51skip**。保存的完整输出指纹为 `af5c4ce8df31e5d038a6f41d4296b69181f2ac2b7b4550f997ecd8ea90be3bb5`；本轮只读取JSON，未取得完整输出另行重算。

7红对应 benchmark、capability discovery、ordinary candidate selection 各1，以及RQA16工具面顺序4项；保存的tail仍显示 discover_tools 与 operation 比较失败。不扩称 renderer/lint/typecheck 已完成或整仓通过。

JSON的before/after六个记录文件均相同，包括 assembly=`ba462c4ed0c85f95667c26653113e7a073504a74aea8f33c6db3fc465945a882`、skill-runtime=`5b1dbf2a1dfaf989080ed1137036a9719949dd2b469dc5e48f24b8a479750823`。这是限定磁盘文件的稳定窗口；这些文件状态不同于QA捕获时的磁盘状态，不能拿来代表PID13260的已加载模块。QA导出函数指纹、磁盘文件hash和传递依赖状态是不同证据层，不能彼此替代。本次check既不抹去已证实的同run L1装配，也不能用来为专业结果背书。
