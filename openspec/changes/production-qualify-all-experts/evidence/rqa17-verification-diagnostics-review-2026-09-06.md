# RQA17 诊断契约：独立旧源红测

2026-09-06。仅新增`tests/rqa17-verification-diagnostics.test.js`及本报告、单独的声明边界分析文档。未改生产源/既有测试/核验决策，未跑API、QA重试或fullcheck。原N/A和并行源码保持不变。已读gitnexus-debugging；query FTS降级，context命中normalizeExecutionEvidence→normalizeTask但lower-bound，无完整process。主线负责生产impact，本轮不编辑生产符号。

## 首次结果与冻结

命令：`node -r ./scripts/register-ts.js --test tests/rqa17-verification-diagnostics.test.js`。

**26 tests / 4 pass / 22 fail / exit1，skipped=0、cancelled=0。** 首次创建后直接跑旧源，没有修改断言追绿。为保留完整分组计数，本轮将命令输出在内存中过滤为测试名称、统计、模块缺失和断言错误；未写回原始QA数据。输出末尾另有register-ts父进程0-test汇总，不是目标文件的实际数量。

| 分组 | 旧源结果 |
|---|---|
| builder/normalizer 12项 | 全失败于新模块尚不存在；lazy import使其不阻止其它集成用例执行 |
| 最后一次candidate诊断、成功repair、phase claimLabels 4项 | 全失败于诊断/标签尚未传出，不是来源核验放行 |
| 用户提示和拒绝文案5项 | 全失败于当前固定读取/议题/责任人提示及“获取相应来源” |
| store落盘重开1项 | 失败于diagnostics被归一化丢弃 |
| stale snapshot、requiredTools/evidence、无关计算＋捏造owner、旧记录兼容4项 | 全通过；已有阻断决策未放宽 |

测试SHA256：`9B56EB30CC84FA1F1B9415E750741FB54D3F52B3DE37012702F96AC6C60AA966`。红测后已通知主线可开始生产补丁，并冻结测试。

旧源即时指纹：

- 新agent-verification-diagnostics.ts尚不存在。
- phases-ground-persist.ts：`F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C`
- workbench-task-store.ts：`483ADCF52E7E40FA2756EC90AAFF453E758A1D6380F576A1E33D54E74791748C`
- agent-grounding-labels.ts：`95A800565AA5B0915758C38BA0BFB13401EB35A50D448679722C14A05B3051BE`
- agent-grounding-ledger.ts：`C0961EAFB42321F2F78D0A4AAC715446F6134884F2B9D775608713F45A824767`

## 测试覆盖及边界

- candidateHash对实际被检查字符串SHA256，含首尾空白/换行，不使用trim结果；字段仅label/valueHash/support，禁止保留value/text/未知字段。30条输入保留全计数，存储数组最多16。
- 正常化拒绝错误version、candidate/material/value hash及run不匹配；超长ID、非安全计数可拒绝整个诊断或安全归一化，不规定题面以外的具体数值上限。标签限24字符的Unicode字母/数字/空格/连字符。
- 无材料诊断为null snapshotHash/0 count。异task/run或篡改snapshot可安全拒绝或不给材料认证，不允许记录伪有效snapshotHash。
- 真实AgentRunExecutor与verifyClaims/GROUND运行：MODEL stop后grounding修复，以及MODEL length后收敛两条路径，均要求诊断绑定最后检查的candidate2，而非candidate1或平台拒绝文。另覆盖修复成功与同run来源snapshot一致。
- 60字段重复输入检查full count、16条记录上限和唯一claimLabels；phase不保留claims值。store使用独立临时tasks.json真实落盘并重新createStore读取，验证诊断、最多8个唯一安全标签及无私值落盘。
- 使用现有createMockRunPorts作settings/context/session/模型边界fixture，不是生产模型或全task UI链；没有mock核验结论。store持久化单独走真实实现。临时目录测试结束清理。
- 旧证据无diagnostics仍可读取；异run诊断不得附在当前evidence。未覆盖所有非法对象组合、Unicode规范化或hash抗猜测性；SHA256是指纹，不是低熵字段的加密承诺。

本轮只授权diagnostics及说明文案，不能据测试绿修改verifyClaims/executionClaimText豁免。一般声明分类、引用误判及混合伪引用发现另存`rqa17-claim-boundary-analysis-2026-09-06.md`，不纳入本轮生产决策变化。尚未跑修复后绿测，不预填通过。

## 追加：首版补丁26绿，但独立hash类型反证仍红

主线五文件补丁落地后，本评审保持原测试hash `9B56EB30CC84FA1F1B9415E750741FB54D3F52B3DE37012702F96AC6C60AA966`，用同一仓库preload命令独立复跑：**26/26、exit0、无跳过**。首次4过/22失败历史保留。不能据这26绿宣称类型边界完整。

主线实测发现candidateHash数组可穿透后，依要求新增独立文件`tests/rqa17-verification-diagnostics-types.test.js`，未修改原26项或生产源。仍用`node -r ./scripts/register-ts.js --test`，在修复前helper SHA `E5859F3D996E527031481005BCBFC62EBC0A369F2FBBFAEB6C442D2604211AFD`上实际得到：**17 tests / 5 pass / 12 fail / exit1，skipped=0、cancelled=0**。

| 补充反证 | 数量 | 结果 |
|---|---:|---|
| candidate/material/value hash单元素数组 | 3 | 失败：RegExp.test隐式转换后返回原数组 |
| 三类hash的普通对象`{value:hash}` | 3 | 通过：返回null且不抛错 |
| 三类hash的可转换对象`toString→hash` | 3 | 失败：转换后通过却保留原对象 |
| 三类hash的null-prototype对象 | 3 | 失败：正则隐式转换抛错，而非返回null |
| 正常primitive string、materialSnapshotHash=null | 2 | 通过 |
| store evidence接收三类数组hash | 3 | 失败：未丢弃非法诊断；blocked/verificationPassed=false前置断言仍通过 |

独立类型测试冻结SHA256：`8E8846C9C7EEDFB5974FE52CCAFE92A6BC471A758057F7CAD105FE3C179D3A95`。已立即通知主线可修类型检查。最小建议为三个hash位置先判primitive string再做格式匹配；materialSnapshotHash另保留显式null。此缺陷是诊断数据类型/异常处理问题，没有证据表明它改变核验或授权。

源码只读复核：GROUND在最后一次verifyClaims之后、refusal替换之前构建诊断；store按evidence.runId归一化接收，不拿诊断覆盖gateStatus/verificationPassed。getViolationClaimLabels拒绝不安全或超过24字符的标签，而非把恶意长标签截成可接受前缀；查看前32个、去重取8个。原26项已验证candidate2、来源绑定及真实store重开。其余类型修复及补充17绿尚待主线落地确认，不预写通过。

阶段措辞更正：用户持续目标已经授权一般修复；当前优先完成诊断，后续分类修复受排序、设计与验证约束，不是需要重新授权。相关分析末段已按要求改正。诊断指纹仍不等于真实来源证明，不能作为执行成功或审批权限输入。

## 追加：类型守卫落地后冻结43项绿及独立源码复审

主线三个hash字段增加primitive string守卫后，本评审执行：

`node -r ./scripts/register-ts.js --test tests/rqa17-verification-diagnostics.test.js tests/rqa17-verification-diagnostics-types.test.js`

**43 tests / 43 pass / 0 fail / exit0，skipped=0、cancelled=0。** 两份冻结文件未变：原26项SHA `9B56EB30CC84FA1F1B9415E750741FB54D3F52B3DE37012702F96AC6C60AA966`；补充17项SHA `8E8846C9C7EEDFB5974FE52CCAFE92A6BC471A758057F7CAD105FE3C179D3A95`。原26项4/22、补充17项5/12红测与首版26绿仍完整保留。

### 数据、绑定与安全审阅

- 三个hash入口均先`typeof === 'string'`再正则，无数组/对象隐式转换；materialSnapshotHash保留显式null。当前普通对象、可转换对象、null-prototype对象都返回null而非抛错；store不再保留这些非法诊断。
- 输出只构造明确允许的键。candidateHash/candidateChars来自最后一次实际检查文本，生成位置在repair复核完成后、refusal替换前；来源在当前task/run验证后再次供builder校验。诊断保留全字段数，最多16条hash化字段，标签只接受安全字符且不超过24，唯一claimLabels最多8。无额外候选正文或字段原值落盘。
- 超长/危险标签采取拒绝而非先截成看似合法的前缀。taskId有界；runId必须与归一化接收方一致，store使用自身evidence.runId传入。旧记录无诊断保持可读；坏诊断被丢弃不覆盖blocked/verificationPassed=false。
- 当前源码全文检索verificationDiagnostics仅命中新helper、GROUND输出和store接收；未见进入verifyClaims、工具权限、requiredTools/evidence或完成判定的读取。结构化诊断可被外部伪造有效形状，故即使hash格式合法仍不能成为权威；设计必须继续保持此单向数据流。
- 原26项复核了candidate2而非candidate1/refusal、成功repair、stale snapshot、真实store落盘重开和原有必需工具/无关计算/捏造owner阻断；补充17项验证拒绝非法hash不会把失败证据改为成功。
- 另执行只读Node vm探针：无CommonJS的`window.GroundingLabels`可运行；同时有window/module.exports时两者格式化结果一致。安全标签“结论”保留，危险/超过24字符标签剔除；false_execution_claim不再误称读取。仅在内存装载实际labels源，无UI/浏览器重试或文件修改。

### 局部变更证据与指纹

不能把共享脏树相对HEAD的全部diff算成本次补丁。逐文件在内存中反向去除已审阅的新诊断引入/输出、store保存、labels helper/文案、拒绝文案后，整文件SHA均精确回到首次红测前值：GROUND→F26E2A7D…，store→483ADCF5…，labels→95A80056…，ledger→C0961EAF…。新helper反向撤去三处字符串类型守卫，精确回到补充红测E5859F3D…；没有磁盘回写。因此核验决策未被这些旧文件的其它改动悄然放宽。

本次审阅当前SHA256：

| 文件 | SHA256 |
|---|---|
| agent-verification-diagnostics.ts | BBC54571D6DF8AA3F3098016698EE768F54917EA8F67B094BF27249A73D2067F |
| agent-grounding-labels.ts | 85144AF9192A7BD247357730E72B9D38676940CFB312550F2DEA1D3317CEAEA1 |
| agent-grounding-ledger.ts | 90512AAEB7F2014A988D9BD0CEE4FCC8E9282918E89AE329C1ABB6D6E28032E9 |
| phases-ground-persist.ts | 4E9C100EE2CE464800559E36479397A045C6B1DD3F01A3707DA8FEEA8B653C11 |
| workbench-task-store.ts | CC3594C842FF2FE30017A4A57A6BDEFD85F6998C96A64BFC88221AA0EC88BE96 |
| agent-claim-source-check.ts（未变） | 5CC1F9E43413D26974D2322F1BC6A9EA6D6AEF4C399B35A651B0DD700AF2EF8D |
| phases-model-tool.ts（保留并行版本） | 622437A47DBF0C70903BBBB2760883EF996C6AB66CA6082D58BE7643D5B8D285 |

结论：当前诊断记录、类型拒绝和通用说明文案的定向验收通过，没有发现必须阻止本轮诊断补丁的剩余问题。**不是语义误判已修复，也不是专家资格通过。** 接收正常化只认证形状/run绑定，不能恢复或验证历史候选原文、不能认证任意声称的snapshot真实性；计数是非负安全整数而非专业质量指标，SHA也不是低熵值加密。未声称覆盖恶意JS getter/proxy或所有异常结构；持久层JSON输入与所测类型边界明确区分。

主线报告fullcheck1470执行中、真实SA重试执行中，本评审没有代跑或预填结果。主线说明当前QA进程启动于类型守卫前；正常字符串流程应不受该类型补丁影响，但不能把该QA运行标记成最终helper hash已加载。真实run版本披露与资格评分另行记录，原N/A不覆盖。本评审本轮没有生产编辑。
