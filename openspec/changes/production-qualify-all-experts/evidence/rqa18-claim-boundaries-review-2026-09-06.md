# RQA18 引用边界独立红测与分析裁决设计

2026-09-06。本轮仅新增测试及本报告；未改生产、既有测试或历史报告，无 API/QA/fullcheck。沿用 GitNexus debugging 流程：本轮相关 query 无结果、context 未找到目标，按 FTS 降级转当前源码检查；不把索引缺失解释为没有调用者。

## 已冻结的引用半边

文件：`tests/rqa18-claim-boundaries.test.js`。

命令：`node -r ./scripts/register-ts.js --test tests/rqa18-claim-boundaries.test.js`。

旧源实际结果：**32 tests，17 pass，15 fail，0 skipped，exit 1**。直接调用真实 `verifyClaims` 和 `applyOutputGate`，固定合成材料，无模型 mock 或语义 reviewer。通过仅代表现有有限门禁，不代表全文语义真实或专业合格。

| 冻结对象 | SHA256 |
|---|---|
| 新测试 | `9C72C3781E165A37280F124C083F859D21C824D892B2A2D3DE1E266100975A12` |
| agent-claim-source-check.ts | `5CC1F9E43413D26974D2322F1BC6A9EA6D6AEF4C399B35A651B0DD700AF2EF8D` |
| agent-grounding-ledger.ts | `90512AAEB7F2014A988D9BD0CEE4FCC8E9282918E89AE329C1ABB6D6E28032E9` |

15 项红：11 项全文缺失引用（普通正文、不同句/行、owner 前后混合、R10 不借 R1、24 个有效引用后再追加缺失引用），3 项 Markdown 排除不得豁免同篇其他引用，1 项无关 calculate 成功不能支持缺失引用。

17 项绿：5 项有效/重复引用控制，6 项 Markdown 链接、图片、已定义引用式链接/图片、任务框排除，6 项安全控制。安全控制覆盖伪造 owner、显式客户评审结论不得借另一来源、缺失 owner 引用、ID 前缀、实际发送无回执、requiredTools/evidence 缺失。链接仅检查语法，不访问网址，也不将网址存在视为事实支持。

## 三项语义不变量

1. **每个真实来源引用均须解析**：有效引用不能洗白缺失引用；重复合法 ID 无害。Markdown 语法排除限于对应片段，不能覆盖全篇。诊断条目上限不能导致后部引用漏验。引用存在与其支持声明内容是两件事。
2. **分析允许推导**：自身分析不要求结论逐字出现在材料，也不能仅因标题、冒号或引用就被当作原文归属结论。需有受宿主约束的分析裁决依据，不能在直接 `verifyClaims` 中无条件放行任意“结论”。
3. **混合声明逐项守门**：owner/time 等事实、明确来源归属、助手完成操作与显式工具/证据契约保持独立核验；一项分析成立不能批准旁边的事实或操作声明。

当前风险定位：`src/lib/agent-claim-source-check.ts` 的 `labelledClaims`/`checkProvidedFieldClaims`（约20/54行）仅在已识别字段内收集引用，再过滤存在的来源，导致普通正文漏检及 `[R1][MISSING]` 借有效来源通过。`src/lib/agent-grounding-ledger.ts` 的 `verifyClaims`（约328行起）应保留独立工具、证据与操作完成门禁。RQA17 诊断记录仍非裁决权限。

## 分析半边：接口待定的集成测试设计（未实现/未执行）

以下不是新增直接 verifier 放行断言，也未加入 skip/todo 来增加测试数。主线决定 bounded reviewer 接口后落为独立集成测试；不需要专家 ID 或持续扩大的标题白名单。

| 自包含输入/反例 | 期望约束 |
|---|---|
| 规范：撤销后最迟5分钟禁访问；观测：第2分钟仍可访问。回答：单凭此观测尚不能判定超时违约。 | 可经分析裁决接受非逐字推导；反称“已违反5分钟上限”不得因带“结论”而接受。 |
| 同规范；观测改为第7分钟仍可访问。回答：该观测违反5分钟上限。 | 同样允许有依据推导，不因结论未逐字存在而拒绝。 |
| 同一合理分析改为正文、标题后、冒号后或带来源引用。 | 语义裁决一致；单有引用不等于逐字归属，不靠排版豁免。 |
| 合理分析后追加无据 owner/date，或“客户已经批准上线”。 | 混合事实独立阻断；分析裁决不能覆盖事实归属。 |
| R1 明确客户评审不通过，R2 明确通过；答复把通过归于 R1。 | 显式事件归属不得借 R2，也不能改称分析而洗白。 |
| reviewer 给出分析通过，但正文带 `[R1][MISSING]`，或无回执声称发送成功，或必需工具失败。 | 硬门禁仍阻断；reviewer 不得覆盖引用、操作及显式契约失败。 |
| 换 candidate、run/task 或材料快照；模型自报 reviewer 通过；reviewer 超时、错误或未覆盖全部待裁决声明。 | 不得形成有效分析批准；具体失败返回形态待接口确认，不预造结果字段。 |

建议 reviewer 记录由宿主绑定 exact candidateHash、validated materialSnapshotHash、runId/taskId 与声明范围，并限制次数、输入大小和时间；声明切分/覆盖不足应可观察，不能只批准前几个片段后放过全文。允许合理推导不等于通用真理证明；仍须保留专业评分与运行时检查的区别。

既有约束需保留：RQA12 claim/source、tool-source、provided-materials 的来源与回执隔离，execution-contract 的工具/证据硬门禁。RQA13 的具体标题/括号实现断言是历史约束，不应盲目复制为新语义定义；若有冲突，由主线显式说明语义迁移，本轮旧文件原样保留。
