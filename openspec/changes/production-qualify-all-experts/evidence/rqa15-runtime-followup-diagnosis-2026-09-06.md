# RQA15 运行时后续只读诊断

2026-09-06。只读源码、当前change保存证据及获准的隔离QA对应run文件；无真实API、用户APPDATA、安装、源码/测试/方法修改、fullcheck或commit。使用gitnexus-debugging：query因FTS扩展缺失降级且无结果；context命中applyOutputGate与buildProductionRunPorts，但为lower-bound、无完整process，按源码fallback追踪。未将不完整索引当完整impact报告。包/23项回归复核另见`rqa15-independent-contract-review-2026-09-06.md`。

## 结论

1. **确定的生产预算接线缺陷**：executor给length修复计算的outputTokens被production adapter忽略，后者仍将finalize请求参数设为min(maxOutput,2400)。离线捕获真实adapter构造的body已复现，非从usage倒推。
2. **UR-H02不是fallback误验收**：kernel DONE并持久化36字平台拒绝，但任务层needs_input、零deliverable、evidence_incomplete/retry。来源字段检查拒绝及错领域提示可定位；现有诊断未保留被拒label/value或FINALIZE原文，不能确定该次具体claim是误判还是模型无据事实。
3. 全部四个SA无提交正文，专业N/A，不填0/5。预算接线修复也不保证模型能完成或达到专业标准。

## 一、SA：策略预算与实际请求不是同一口径

四份`rqa15-{old,new,holdout-old,holdout-new}-live-2026-09-06.json`按task/run逐一绑定：

| 样本 | task | run | 保存结果 |
|---|---|---|---|
| old SA-N01 | task-mtp24yox-gr5k1 | expert_task-mtp24yox-gr5k1_mtp24yur | failed；length→length；deliverables=[] |
| candidate SA-N01 | task-mtp2j3g0-uo0z8 | expert_task-mtp2j3g0-uo0z8_mtp2j3x0 | 同上 |
| old SA-H02 | task-mtp2gg85-1vkiq | expert_task-mtp2gg85-1vkiq_mtp2ggea | 同上 |
| candidate SA-H02 | task-mtp2li38-xgh19 | expert_task-mtp2li38-xgh19_mtp2like | 同上 |

调用链及数值含义：

- `agent-generate-prepare.ts:272,442`：正式专家通常tier=assist（知识检索可另升retrieval），requestedOutput=2000，传routedModel.profile到getRequestPolicy。
- `llm-runtime.ts:90`：outputTokens=min(profile.maxOutput,max(tier最低值,requestedOutput))；assist最低2600，retrieval3200。maxOutput是模型/显式profile上限，**不是当前轮请求额度**。无更低profile cap、无其它tier变化时，初次策略为2600。
- `agent-run-executor/phases-model-tool.ts:186,213`：incomplete只允许一次answer-only修复；策略outputTokens=min(maxOutput,2×原outputTokens)。其它收敛原因仍2400。修复再次length则model_response_incomplete，不提交半篇正文。
- **`agent-run-kernel-adapter.ts:213-238`**：初次body参数读取reqPolicy.outputTokens；finalize则重新计算min(reqPolicy.maxOutput或原policy.maxOutput,2400)，完全不读修复outputTokens。随后原body交给requestAgentCompletion。

本轮离线反例：真实`buildProductionRunPorts`，仅注入捕获body的requestAgentCompletion函数（不联网），maxOutput=8192，分别调用初次与finalize complete：

| 初次outputTokens | executor规则应传修复outputTokens | 捕获初次max_tokens | 捕获修复max_tokens |
|---:|---:|---:|---:|
| 800 | 1600 | 800 | **2400** |
| 2600 | 5200 | 2600 | **2400** |
| 3200 | 6400 | 3200 | **2400** |

这既会缩小正常修复预算，也会违反小预算的2×上界。此前RQA14去掉executor的2400 floor仍有效，但adapter残留独立覆盖；不是旧hash被误读。`tests/rqa14-repair-budget.test.js:35-49`替换了ports.llm.complete，只断言进入端口前的policy，未覆盖端口最终请求体，故35绿不能排除此缺陷。Pasteur旧hash864215的34/35仍是历史记录，本报告不覆盖它。

**实跑观测限制**：同run contextAudit和已读隔离state/events/checkpoint/log没有保存初次/FINALIZE请求body或resolved policy。四个SA的总completionTokens=5000不是单次cap证明。能确认当前生产代码与离线wire反例，不能把“该实跑初次确实max_tokens=2600”写成直接观测，亦不能证明2400是连续length的唯一原因。后续应在已批准的重试诊断中记录每阶段实际预算字段，不读用户配置来猜。

最小建议（未实施）：在生产adapter使用本次已解析reqPolicy.outputTokens并保留模型cap校验及兼容默认；修复原因与预算规则仍由executor决定，不以专家ID或扩大通用上限解决。添加真实adapter请求体测试：800→1600、2600→5200、model cap=3000、小cap、max_tokens/max_completion_tokens、非incomplete既有2400预算、无tools、单次修复及再次length阻断。共享入口涉及executeAgentGenerate、子run factory和主运行时factory；变更须重新impact，按共享HIGH风险处理，不能据lower-bound索引只测SA。

## 二、UR-H02：来源检查、平台替换与任务拦截

绑定：`task-mtp2lix5-e7x7b` / `expert_task-mtp2lix5-e7x7b_mtp2ljct`；保存文件`rqa15-holdout-new-live-2026-09-06.json`。对应contextAudit同run命中；其中sessionId/skillRefs被日志脱敏，不能将`res***is`当完整技能ID。任务brief声明research-evidence-analysis，安装记录成功；同run `skill.explicit-content` chars=1027、hash=`0d1e6a723fd176d3`、truncated=false。这是加载证据，不是专业因果证明。

保存事实：MODEL length、丢弃草稿4273 chars；FINALIZE stop；零工具。VERIFY_CLAIMS提交36字符拒绝，hash=`768f3d3bbe4240a2`：

> 当前缺少可验证的来源证据，不能确认回复中的具体事实。需要先获取相应来源。

executionEvidence.gateStatus=blocked、verificationPassed=false、violation=ungrounded_external_fact，message为“具体字段缺少对应来源片段；材料存在不代表所有声明都有依据”。最终任务**needs_input**、deliverables=[]，attention=evidence_incomplete/retry，progress blocked“执行结果需要重新核验”。不是review，更不是专业合格或fallback误验收。

源码对应：

1. `expert-task-runtime.ts:520,562`从当前brief.materials建立task/run绑定snapshot；prepare:115/819保留；execute:84/178传到adapter/context；GROUND通过validateProvidedMaterials验绑定/hash再传verifyClaims。没有从混合prompt或历史答案补造证据。材料快照与tool/evidence ledger是独立通道，零工具/空ledger不能推导材料缺失。
2. `agent-grounding-ledger.ts:390-433`将providedMaterials.items等传checkProvidedFieldClaims。`agent-claim-source-check.ts:20-90`按有限标签“结论/负责人/议题/日期…”提取，再要求来源中同label、同value的规范化文本匹配。只有有限评审verdict、待确认值及窄建议前缀等例外。不会因材料标注合成而跳过检查；也不会推导表格算术或因果分析。unresolved表示未找到逐字段匹配，**不等于证明陈述错误**。
3. 本run的length已经消耗finalizationUsed。`phases-ground-persist.ts:160`因此不再发grounding修复，gate拒绝后用`buildHonestRefusal`固定文本替换原候选；36字与该分支原样相同。
4. ground-persist:269仅在hasRules(input.executionContract)且验证失败时将kernel终态设ERROR。此任务无requiredTools/evidence/artifacts/completionConditions等；requiredSkills不属于hasRules，故可以DONE同时携带blocked。`expert-task-runtime.ts:650-675`仍按blocked/verificationPassed=false设needs_input并返回，不生成交付物。分层状态不同，不是任务验收漏过。
5. **错领域detail完全来自平台**：`agent-grounding-labels.ts:77`对所有ungrounded_external_fact固定返回“还没有可验证的正文证据，不能输出具体议题或责任人”；runtime:99转为attention.detail。无法据此推断模型真的编造议题或负责人。

### 完整合成材料仍可能被此检查拒绝：已复现，但非实际原答归因

保存brief包含完整996字符材料，SHA256=`5a5db059aa9de00b461631a01cf216eca20c3d3980cf4be099290d21bd58d9ef`；明确合成、无随机记录、顺序学习效应及有限样本。将该全文作为providedMaterials.items传真实verifyClaims，离线构造以下反例（**这些不是实跑候选原句**）：

| 输入文本/来源 | 实际检查结果 |
|---|---|
| “结论：现有材料不能证明新版降低操作成本。” + 全996字材料 | external_fact/结论，unresolved；ungrounded_external_fact |
| 同句去掉“结论：” + 同材料 | fields=[]，passed=true；仅代表有限检查未拦，不是语义验真 |
| “负责人：林某。” + 同材料 | unresolved，拒绝正确 |
| “负责人：林某。” + 另造含同字段的控制来源 | source_excerpt；只表示原文对应，不认证事件真实 |

第一句是对该试验推断能力的合理分析，而非来自外部来源的既成事实；加标签就强制原文逐字支持，说明一般研究结论与来源事实的边界存在确定可复现缺口。**不建议删标签规避gate、不建议合成材料全豁免**；无据引语/事实和虚假执行声明仍应阻断。

### 尚不能确定的实际claim

已读上述live/contextAudit，以及授权隔离根`D:/UserCaches/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`下本UR run的state.json、events.jsonl、checkpoints/latest.json和日志内匹配run的条目。均未见FINALIZE未替换正文、fieldChecks或被拒claim的label/value。ground-persist:306序列化violations只保留code/message/missingTools，**丢掉了verifyClaims本来生成的claims字段**；材料明明已给与具体声明是否有据不能仅凭总错误码区分。contextAudit也不是GROUND snapshot原文收据。

因此当前可确定“来源标签检查拒绝→平台替换→任务拦截”和错领域提示；不能确定实跑被拒的是研究结论、计划字段、还是确有无据的人名/引语，也不能排除历史运行材料接线/快照缺失。当前源码链未发现丢字段，不等于已恢复历史内存。原模型专业错误、该次具体误判归因均待原候选/字段诊断，不能拿36字平台文评分。

最小建议（未实施）：先保留有界、脱敏的候选hash、被拒字段/类别、来源id/hash与匹配状态用于诊断；通用提示改为对应领域中立的“部分声明未匹配材料依据”，不硬说会议正文缺失。验证逻辑区分来源归属事实与分析/提议，无法判定推理时记录范围与不确定性，不把缺少同名字段当确定事实错误，也不把材料存在当全篇真；不能仅扩大建议/结论正则白名单。保持显式requiredTools/read evidence、task/run/hash绑定与执行凭据严格核验。

验证清单：同全文研究推断、表格计算、建议中的无据理由、虚构引语/人数/负责人、未知citation、真实带来源的结论引述、材料缺失/异run/被篡改；length修复后再gate拒绝不得多调用模型/重放工具；kernel终态和任务blocked/零deliverable均断言；错误提示不借用无关领域。是否调整kernel DONE的观测语义应另审共享契约，勿借本例误报“已review”推进修复。

## 审阅源码指纹

- agent-run-kernel-adapter.ts：`BCFA56EEABBAE0A2B4BF8DA815503F1C2646E804AE0011D788D16BA247B2B50D`
- phases-model-tool.ts：`6706778DFE5DDBC54D4693AAADE06E845B75950BEB98F1395ABA08B5348F62E7`
- phases-ground-persist.ts：`F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C`
- agent-claim-source-check.ts：`5CC1F9E43413D26974D2322F1BC6A9EA6D6AEF4C399B35A651B0DD700AF2EF8D`
- agent-grounding-labels.ts：`95A800565AA5B0915758C38BA0BFB13401EB35A50D448679722C14A05B3051BE`
- agent-grounding-ledger.ts：`C0961EAFB42321F2F78D0A4AAC715446F6134884F2B9D775608713F45A824767`
- expert-task-runtime.ts：`48BF68BE9EA5D6641CF3C7E476B5CECC3903FE3EAE5E097C49C5BD5807BFB05E`

仅本诊断报告新增及契约review追加；旧报告、原始失败、评分、Skill/案例全部保留。没有把专业N/A或运行时故障变成方法A/B胜负。
