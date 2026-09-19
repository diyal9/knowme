# RQA21：分析判断误分类与修复数值回归（2026-09-06）

## 结论与范围

只读调查证实：DA-N01 初稿的分析判断被当作需来源逐字支持的“结论”字段，触发通用 FINALIZE；同 run 修复把正确的总体40%/-10pp改为错误的42%/-8pp，现有 gate 未检查该算术。当前磁盘源码仍可复现初稿失败、修复稿通过。不是初稿全文专业正确，不是计算工具算错，也不意味着 task review 已验证专业质量。

本轮只新增本报告；未修改源码、测试、原始输出或既有报告，未访问用户 APPDATA、调用真实模型/API、执行 QA retry 或 fullcheck。以下行号相对本轮读取的磁盘文件，不冒充历史 QA 的已加载源码。

## 同 run 证据与独立复算

来源：`evidence/rqa20-new-live.json`（SHA256 `ac0890d3143aaafdf82b8775474590f0703b7989c75f596cde72101bb847c3ef`），及已有 `evidence/rqa20-live-context-audit-2026-09-06.md`。本报告不覆盖旧审计。

- task：`task-mtpb1ylk-lttbs`；run：`expert_task-mtpb1ylk-lttbs_mtpb2038`；session：`wb-expert-task-mtpb1ylk-lttbs`。
- 两次 providedMaterials 全对象一致；snapshotHash：`88f42b5ff2890b14d0c78f9d54b99e7957603c3ff1a62cc2e6672c88f5bfd662`。
- M2 原版：100人/80完成、100人/20完成；新版：50人/45完成、250人/75完成。总体原版100/200=50%，新版120/300=40%，新版减原版=-10个百分点；两个分组分别80→90%、20→30%，均+10个百分点。

| observer | 候选与验证结果 |
|---|---|
| index4，04:22:15.955Z | 923字符；正确40%/-10pp；“结论：经理草稿不能作为立即全量回退的决策依据”被报 `ungrounded_external_fact` |
| index6，04:22:25.075Z | 934字符；写成“42.00% (120/300)”及-8pp；该判断改为“对经理草稿的判断”标题；验证 passed，fieldChecks=[] |

index4 SHA256：`5ff7477d05efc6d5786a97e51647749674f61a4f147e5815a506966c36a45123`；index6：`595aac49c228c86e5be86e007daaa66e31fa0686d7d80cba0a82c18886e11cd3`。实际 metrics 为 MODEL/stop → FINALIZE/stop，并非 length 修复。两次 toolLedger.calls、evidenceLedger.entries、toolMessages 均为空；审计复算不是原任务工具回执。

本轮以保存的两个 capture.args 直接调用当前 verifyClaims/applyOutputGate（本地、无模型）：index4仍出现上述唯一未支持字段、regenSuggested=true；index6仍无字段、passed=true。初稿另有“掩盖了改版对单一客群的正面效果”等因果措辞，不由正确加总获得整体专业背书。

## 当前规则与真实修复链

源指针（仓库相对路径）：

1. `src/lib/agent-grounding-state.ts:12`：EXTERNAL_FACT_RE 把“结论：”与负责人、日期等并列。
2. `src/lib/agent-claim-source-check.ts:19`：labelledClaims 做 Markdown 投影和分句；`:10`、`:43` 的有限 REVIEW_VERDICT 只豁免“通过/需修改”等有限评审词。上述实质分析判断不在其中，被标记 external_fact。`:58`—`:84` 只检查来源中同 label、同 value 的精确字段；缺匹配只是 unresolved，不证明判断错误。这将“由材料推导出的建议”与“材料记载某主体已作出的结论”混淆。
3. `src/lib/agent-grounding-ledger.ts:419`—`:434`：未匹配字段变为 ungrounded_external_fact；`:484`—`:501` 将该违规列为一次可重新生成的理由。全局来源身份核验独立存在，不能因改善分析分类而取消。
4. `src/lib/agent-run-executor/phases-ground-persist.ts:92` 验证当前 task/run 材料，`:128` 验正文、`:137` 独立验执行契约；`:161`—`:162` 调用 `finalizeResponse('grounding')`。只传 reason，没有传具体违规字段、原候选哈希或已核验数值。`:176` 后再次验修复稿，并重新附加原契约失败；修辞变化不能补造必要工具、文件或回执。
5. `src/lib/agent-run-executor/phases-model-tool.ts:295`—`:355`：grounding 使用通用“基于当前对话和已经返回的工具结果，直接给出最终答复”指令，不是定向改错。`:309` 从 apiMessages 拼装；普通无工具终稿路径在`:535`—`:574`设置候选后直接 break，未将该初稿作为 assistant 消息追加（工具分支追加在`:604`）。所以当前这条路径也没有显式把被拒初稿交给 repair；原委托/材料仍可在原对话内，不应误称所有上下文丢失。
6. `phases-model-tool.ts:317` 经 completeWithinBudget → ports.llm.complete → `src/lib/agent-run-kernel-adapter.ts:214`—`:245` → requestAgentCompletion。grounding 是一次无 tools 的整篇重新生成，输出预算为2400并钳模型 cap；只有 incomplete 使用翻倍策略。adapter取本轮额度，cap取本轮/原policy较小值，写最终参数名对应的 body 字段；不是 RQA16 的 length 预算接线回退。

这条链没有算术检查或旧/新已验证数字不变量。换掉“结论：”外形即可使本例字段集合变空，但不使42%(120/300)成为正确结论。历史 observer 与同 run metrics 证实修复发生；未保存可按 run 精确绑定的完整 HTTP body，因此不声称已还原历史请求全部消息、实际 cap 或传递依赖版本。

## 通用修复边界建议（本轮不实现）

应分轴处理，而非扩充标题/专家白名单：

- **执行轴**：助手声称已经完成的操作、显式 requiredTools/evidence/artifacts 必须由宿主真实回执验证。分析 reviewer、材料引用和无关 calculate 均不能豁免。
- **来源轴**：明确归属于他人的事实/已发生事件、负责人/日期等事实字段，保留来源绑定、引用身份和支持检查；引用存在不等于引用支持了声明。分析段落里的 `[R1][MISSING]` 仍需失败。
- **推理轴**：分析者自己的推导、条件设计、建议不要求结论逐字存在于材料。需标明前提、适用范围、假设和可核验计算；状态应区分“在假设下支持 / 未决 / 与材料矛盾 / 未检查”，不合并成全文 semantic truth。建议中的无据理由、归因、既成事件仍必须拆出审查。

以准确文本 span 为单位处理混合声明；“建议回退，因为负责人已确认上线事故”不能因前半句是建议而放过后半句。必要时使用有界、宿主锚定的语义 adjudication，但不是把另一个模型的 pass 当权威：校验当前 run、candidateHash、snapshotHash、精确位置/来源摘录、字段和数量上限；来源摘录仅是锚点，不自动证明蕴含。对未覆盖或分类不确定的部分保留未决，不能扩大到整篇豁免。先避免把“未找到逐字分析结论”直接等同事实造假，不能简单跳过所有 ungrounded_external_fact。

修复应接收有界问题清单和被检查候选，优先局部修改；固定材料快照与候选哈希，重新检查修改后全文及硬契约。只靠“请保留数字”的提示不足。对确实纯分析分类争议，可保留候选和结构化诊断等待适当 adjudication，而不是盲目反复重生成；不能借此提交仍含未解决硬事实/执行违规的正文。

### 数值不回归：能确定性验证什么

本例可确定性验证：同一表格的 numerator/denominator、分组、sum、ratio、百分点差及舍入。120/300=0.4，因此“42%(120/300)”本身就有可判定矛盾。建议用受限结构化计算记录绑定不可变 source/row/column、统计对象、单位、公式与舍入；宿主复算并比较修复前后已验证结果。

不要执行任意模型代码；可使用有界安全表达式/算子和十进制或有理数计算。还需验证分母选取、分组口径、%与pp、零分母及合法舍入，不能只看表达式运算成功。只保护**已独立验证**的数字，允许原错数纠正；不能冻结所有初稿数字。删除数字、换标签/单位或偷偷换统计对象也不能绕过已约定不变量。开放自然语言的所有数值、因果和决策正确性无法由有限算术校验器整体认证，未覆盖项必须明示。

最小证伪计划（未新增测试）：

1. 同材料“据此建议暂不全量回退”可成为有前提的分析；“客户已决定不回退”仍需事件来源。更换专家ID、标题和版式不改变语义结论。
2. 混合建议+虚构负责人/确认事件、已完成操作、必需工具失败：不能由分析 pass 洗白；未知/混合引用仍拒绝。
3. 初稿正确40/-10 → 修复42/-8必须拒绝；初稿错误 → 有锚点的正确修复允许；舍入等价允许，换分母/pp单位/删掉必要指标不可偷渡。
4. reviewer提供真实摘录但不蕴含结论、漏覆盖混合子句、跨run旧快照、伪造hash：不得成为放行依据。

既有约束：`tests/rqa13-review-assessment-boundary.test.js` 的评审措辞、夹带事实/完成声明控制不能丢；RQA18引用身份与代码/Markdown控制、RQA17最后候选诊断和非权威边界、RQA16无工具/不重放/二次length阻断继续保留。`evidence/rqa18-semantic-shadow-review-2026-09-06.md` 已记录 shadow 的标签/理由不一致、摘录不等于蕴含及覆盖不足，不能据旧 shadow 直接开放通用放行。

## 历史 check7fail 与当前磁盘：限定复查

历史 `evidence/rqa20-check-28046.json` 保存 backend 3010pass/7fail/51skip、exit1，是事实，保留不覆盖。本轮仅复跑与那7项对应的四个现有测试文件，使用仓库 TS resolver：

```text
node -r ./scripts/register-ts.js --test tests/agent-benchmark.test.js tests/agent-capability-authorization-integration.test.js tests/agent-execution-intent.test.js tests/rqa16-production-repair-budget.test.js
```

实际结果：**53 tests / 53 pass / 0 fail / 0 skip，exit0**（UTC约05:24）。其中2+4+18+29项；七个历史失败对应测试在当前版本通过。不是新一次 fullcheck；不能宣称 renderer/lint/typecheck 或整仓已绿，也不能由工程测试推导 DA 专业问题已修复。

相对28046记录的 after，当前 assembly 从 ba462c4e…变为0ec09e0d…，GROUND从398fc462…变为af8582a6…，ExpertTaskRoom从81bef…变为54300e0d…；记录的 skill-runtime、grounding-runtime、catalog hash仍一致。可确证磁盘已变化，不能把旧红继续当当前红，也不能仅凭变化定位七项失败的唯一因果或归罪专家包。

本轮未改测试，但不能称测试历史冻结不变：当前RQA16测试 SHA256 `a9161c1b520f44140c4c0d3b35e77762dda6e84d6bd48ef313bed56563b5f68e`，不同于原RQA16报告的 `20715a4416a9968354ba2aab3424aab8427f7efaa26732b51096f98f9a6e237e`。其余三个当前测试SHA依次为 `7918a37c3843c89e81128723df0c7a31e12dbfab213336653d8987bbc61fe215`、`a721ea7f1604d686cd42e5597782436cc3bb5340a3ae0cdc392c0ce795c6bc79`、`957909868b663138348d71304ce5e5c2946693562a46da27b69ed116538fcf11`。后三文件中的 capability/intent及RQA16为未跟踪文件，git diff空不证明历史未变；未取得28046四测试原文快照，不能认证源修复是绿测变化的唯一原因。

定向运行前后监测的六个源码 hash一致：

| 文件 | SHA256 |
|---|---|
| agent-claim-source-check.ts | 914b727aed3b651f59d7e86e8f2723c04e9497b69bb060576540ee107507fa69 |
| agent-grounding-state.ts | d96ddf6b8cf003606251078c971348c3c144300ca1f66f54877defffdb3a56fd |
| agent-grounding-ledger.ts | 0892fd90596abe577df15baa962503ab493c447a481702f976c2a594a1e18e1d |
| phases-ground-persist.ts | af8582a6d39d65b138016ca9a15cd4b614845a3cfa810523d8b03dfa32204098 |
| phases-model-tool.ts | afc6ce7a4af968abcc7d7003cf7787393c5c402412ee8463b3d50e37fee13250 |
| agent-context-assembly.ts | 0ec09e0da814c542c6bc9717bfdc512f77b53fcf018d21613525ac14d979b620 |

这是有限监测窗口，不是全传递依赖冻结；更不能代表历史隔离QA PID13260已加载代码。

## 调查方法与限制

已完整读取 gitnexus-debugging / gitnexus-exploring 技能，执行症状 query 和 verifyClaims、runGroundAndPersist、finalizeResponse 的 context。query无匹配且FTS降级；索引时间为8月27日，context为lower-bound。context列出的 process 资源读取返回not found，随后只读源码补足链路。未在本轮重建索引或触网；图返回UNKNOWN/缺边不构成安全证明。无生产符号修改，因此未声称完成修复impact或工程验收。本报告仅诊断本例暴露的通用边界及有限回归状态，不是全系统认证。

## 追加：check29773 六红的限定只读复查

主线报告 check29773 为3199 total /3142 pass /6 fail /51 skip，分布 cold-MCP 1、lazy-projection 3、connector-runtime 2。本轮 evidence 目录未找到29773原始输出/源码快照，以上全量计数归属主线报告，不冒充本代理重跑结果。重新读取 gitnexus-debugging，query仍FTS降级无结果；context(buildConnectorToolSurface/buildToolSurfaceFromRegistry)均lower-bound且无process，转当前源码核查。

**不能把六项归为同一个注册问题。** 单次定向运行当前三个文件，实际 **20 tests /17 pass /3 fail /0 skip，exit1**：

```text
node -r ./scripts/register-ts.js --test tests/agent-cold-mcp-rounds.test.js tests/connector-lazy-projection.test.js tests/connector-runtime.test.js
```

只运行这一次；mock MCP/HTTP、本地临时fixture，没有真实连接器或模型调用。随后共享测试又变化，未再次运行，也未改别人源码/测试。

### 1. cold：本次红是宿主授权fixture缺项，不是已证明注册失败

实际失败：`agent-cold-mcp-rounds.test.js:73`，`mcp.c499.echo not offered on round 2`，terminal ERROR而非DONE。

运行时读取的fixture为：

```js
const built = buildToolSurfaceFromRegistry(registry, { userData, runId: 'run', sessionId: 'session' })
let allowed = true
```

而当前 `src/lib/connectors/lazy-mcp-projection.ts:124`—`:137` 的 checkScope：有runId/sessionId就必须调用 ctx.validateExecutionApproval，结果非ok即scope_denied；调用发生在 connect/listTools/project/onToolsLoaded **之前**。`tool-surface-builder.ts:191`—`:205`传入该回调，registry.projectToSurface将ctx沿治理handler透传；外围 guardCapabilityToolSurface 的 scope.decision 只作外围检查，不会凭空补出这个回调。因此旧fixture进入loader会先被拒，不能由后续“schema没出现”推论registry拒绝了有效注册。这一内部错误路径为源码与已读fixture推导；本次测试失败输出本身只打印下一轮缺schema，未打印loader receipt。

运行后再次读取，另一作者已将该fixture改为声明 validateExecutionApproval，并核对allowed、run/session及connector可见性。仅在内存把这段还原成上面实际读到的旧段，重算SHA：`4b87510ef932b7dcdf0bad3aca1bf62929e1fe3ad4ef1fd19dfd8adbdfa36f79`，与运行前后打印前缀一致。当前新测试SHA为 `4a2e84b402aaa616a2225774da66de38f17f54a247b1cf7dc57b7e0d42ef53d3`；**本轮未验证新版本绿**。不建议删掉loader的执行前/发现后权限复核以迎合旧fixture。

### 2. connector-runtime 两红：eager旧契约与lazy当前行为不一致

- `tests/connector-runtime.test.js:202`：建surface后立即期待mcp.one.tool_a/mcp.two.tool_a及两个已开启进程，实际远端名集合[]。
- `:244`：manifest-only连接器建surface后立即期待mcp.manifest_only.echo，实际没有该远端名。

当前 `src/lib/connectors/tool-runtime.ts:346` 已由旧 buildMcpAgentProjection 改为 buildLazyMcpProjection。后者`:113`—`:123`在无cache时只提供mcp_load_<id>入口，选中loader才连接和列schema；ephemeralSessions只影响会话实现/关闭方式，不是eager开关。上述两测试完全未调用loader，故此刻没有mcp.*是当前冷启动契约的直接结果，不是“handler注册丢失”。底层 buildMcpAgentProjection 的多MCP测试本次仍通过，不能扩大为底层MCP整体坏掉。

git diff相对HEAD证实：tool-runtime由eager改lazy、增加onToolsLoaded与动态registry surface；connector-runtime测试只有import变化和末尾新增三项，这两个原有eager测试的步骤/断言未相应迁移。此比较是HEAD→当前，不冒充29773→当前精确diff。最小收尾建议是保留生命周期/manifest意图，按新契约先断言冷启动无I/O，再真实调用本地mock loader，断言动态schema/handler可见与最终close清理；不应仅删除旧断言。当前本代理不实施。

### 3. lazy-projection 历史三红：本次不复现，不能补造历史根因

该文件当前7/7通过，涵盖cache复用、配置/凭据失效、坏连接器隔离、超时/ID冲突、变更拒绝、HTTP边界及取消。测试直接调用 buildLazyMcpProjection，未经过 tool-contract-registry.registerTool；因此就其测试结构而言，不能把缺definition/handler直接归为共享ToolContractRegistry注册故障。

当前实现`:151`—`:152`向bundle增量加入definition/handler，`:184`—`:185`用getter从successful bundles重新聚合；不是一次性flatMap/Object.assign快照。tool-runtime`:355`—`:363`负责onToolsLoaded注册；dynamic-registry-tool-surface.ts按registry条数变化刷新读表和dispatch。必须区分“projection聚合能看到新增项”与“registry注册并对下一轮授权/dispatch可见”两层。

若旧代码返回一次性聚合快照，确实能导致bundle已加载而调用者看不到新handler/schema，但**未取得29773这三项的具体错误和当时源码，不能把这一条件性解释写成历史已证实根因**。当前getter源码加7绿只证明当前局部行为。该源和测试均未跟踪，git diff为空不能用来认证历史不变。

### 当前指纹、共享变更与边界

运行前后打印的十文件hash前缀一致，但PowerShell表格截断了完整hash，故不宣称取得十个完整before/after比对。随后读取完整当前值如下；cold测试已发生上述可见变化，其他列值与运行前后所示前缀对应：

| 文件 | 当前SHA256 |
|---|---|
| connectors/lazy-mcp-projection.ts | ca50c21a6b6b524055a466a6e1ba8318083415453b3f2e1c8d4224aab4f1135a |
| connectors/tool-runtime.ts | ead0fefded93ab7940dfb8eeebd405414ae73273a2ed56e23a86ac887705343b |
| dynamic-registry-tool-surface.ts | 7ec88c69b5831ec1c3eeb49e08a41e343ede25edab7e52d81c8864558e6a0b8e |
| tool-surface-builder.ts | 5ab0152edad3b0d26869d560e73e5685c5c4bae776663319b8bbc211a7b8f446 |
| agent-run-executor/phases-model-tool.ts | 14bf3e72e85d1aeb160276158de5648656dc47a6b3d1d571ee840e498a778af7 |
| tests/connector-lazy-projection.test.js | a92a48534855f03c62f4a7620011b91c1854c79ef61321ea0c253fa135966751 |
| tests/connector-runtime.test.js | 3bc98fd50a77ab2568df154d16c498ec6a3ddfea60525a235b855cc0369474cd |

这些是追加调查的磁盘状态，不是上一节53绿时的完整状态，更不是隔离QA已加载模块。当前源码路径揭示了授权fixture、冷启动契约迁移、动态projection三个应分开的检查点；**没有证据把这批失败归因于本轮citation修复**。尚待作者在稳定源码/测试窗口验证cold新fixture与两项生命周期契约迁移；本报告不宣称共享runtime已认证，也不继续扩展系统调查。

## 追加：check96777 新增 RQA12 失败定位

主线报告最新fullcheck为3181pass/3fail/51skip，除前述connector-runtime旧两项外，新增 `tests/rqa12-provided-materials-dataflow.test.js:156`。本轮只读并单次运行该测试名，**1 test /0 pass /1 fail /exit1**，准确复现`:208`的实际error：`Cannot read properties of undefined (reading 'pendingRequiredToolSchemas')`。未跑wholecheck，也未修改源码或测试。

```text
node -r ./scripts/register-ts.js --test --test-name-pattern="production execute projects the validated prepared snapshot" tests/rqa12-provided-materials-dataflow.test.js
```

### 确切根因

`src/lib/agent-run-executor/phases-model-tool.ts:415` 新增required MCP schema依赖选择时读取：

```js
ctxBundle.contextInfo?.pendingRequiredToolSchemas || initialToolSurface.pendingRequiredToolSchemas || []
```

第二项缺少可选链。该表达式在每轮selectToolDefinitions入参构建时求值，**不受toolsEnabled=false或contractMissing=[]短路保护**，所以空surface也会在模型请求前抛TypeError。

测试`:172`的mock buildRunToolSurface结果没有toolSurface/contextInfo，tier=chat、contextEngine明确不许工具。真实consumer链为：`agent-generate-execute.ts:49/72`解构并传入undefined toolSurface → `agent-run-kernel-adapter.ts:253`作为ports.tools.surface → `phases-prepare-context.ts:119/123`设置toolsEnabled=false且不伪造surface → model loop的initialToolSurface=undefined。此前`authorizedToolRecords`（`agent-tool-discovery.ts:27`）及loop validate/receipts读取均容忍空surface，新增裸访问破坏这一无工具路径。

测试的context observer先核对input/context snapshotHash、冻结材料与空执行ledger，再进入真实AgentRunExecutor；当前错误不是材料快照校验抛错，而是后续MODEL轮工具选择元数据访问。不能据此认定providedMaterials丢失或sourcecheck回归，也不是MCP注册失败。

### 最小建议与验证边界

建议生产作者仅将该可选fallback改为 `initialToolSurface?.pendingRequiredToolSchemas`，其余逻辑不动。不宜仅往RQA12 fixture补一个空surface来掩盖共享入口的新裸访问。保留contextInfo优先、contractMissing过滤、当前可见loader及connectorId匹配；requiredTools最终仍必须由实际回执满足，不因无surface或schema加载而豁免。无需在此扩展invalid metadata治理或改其它运行时。

修后验证范围可限于本失败原测试、既有required MCP loader控制及无工具路径；必须保持原材料断言与有工具契约失败行为。此处只建议，未修改或通过内存patch模拟绿测。正式buildRunToolSurface通常返回实际surface，因此不能把该fixture暴露的空值兼容缺陷扩大为所有UI真实运行必失败。

### 精确磁盘指纹与证据范围

以下model-loop和测试的完整SHA256在定向运行前后JSON输出中完全相同（本次没有表格截断）：

| 文件 | SHA256 |
|---|---|
| src/lib/agent-run-executor/phases-model-tool.ts | dfad84c631091a0ba790935e375b32173b85ae24c9c95da8b89de83ee6d29e9d |
| tests/rqa12-provided-materials-dataflow.test.js | f3fa5492472704811e1aa13a5c1676daa9c0d291af309a4d25210d1b293c9c48 |

链路读取时附带指纹：agent-generate-execute.ts=`ef1a2f021fc5d395518f0a273a721acb76f934edff14e9600b34dc18590d0dde`；agent-run-kernel-adapter.ts=`365c148c17fed946c3ced093257d12a41f975065b57d67c43cc791bfb679709a`；agent-generate-tool-surface.ts=`d5417e6ce090ea99c1a89b8a2a7a62d728a85228533c0efb53ce3cde9a43cf88`。后三项为读取时指纹，不冒充完整前后稳定监测。

model-loop已不同于上一追加的14bf3e72…；git diff HEAD→当前显示pendingRequiredToolSchemas选择代码为新增，但不是96777前后精确patch。RQA12测试仍为未跟踪文件，无法仅用git diff证明其历史没变。本轮query因FTS降级无结果，context(runModelToolLoop)为lower-bound，随后以当前源码和单测交叉核实。无证据归因于citation修复；未认证全仓状态，主线fullcheck计数仅按主线报告保留。
