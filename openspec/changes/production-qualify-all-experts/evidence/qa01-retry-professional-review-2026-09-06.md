# QA01 同任务retry独立专业评分 — 2026-09-06

## 结论

**原冻结五断言：3/5通过（60%），专业结论：需修订，尚不能认证生产专业通过。**

本次为 task-mtotfx67-mplj8 的真实retry，run **expert_task-mtotfx67-mplj8_mtovv5f4**，平台status=review；正文实际存在，可以评分。iteration-1同任务无正文的失败仍保持N/A，不追记专业0分，不声称本次“从0分提升到60%”。

只新增 iteration-2/QA01/baseline/grading.json 和本报告；未改冻结输入、输出、transcript、receipts、旧grading、源码或Agent包，未调用模型/API或应用。采用skill-creator逐断言text/passed/evidence及额外claims规范；本轮按授权评已有证据，不生成新模型运行、对照实验、viewer或重写方法包。

## 绑定与证据真实性

- evidence/qa01-retry-live-2026-09-06.json 的runId、task.id与指定ID相符，task.status=review。
- iteration-2 baseline/transcript.json与live.session.messages按runId过滤后的两条user/assistant消息深比较一致；不按消息数组位置关联。
- answer.md去首尾文件空白后，与本run assistant.text及同task/run的artifact.body全文一致。
- task.brief.materials中的QA01原文与professional-batch3-inputs.json的冻结input相同；user消息包含该完整材料。原五expectations与iteration-1 metadata逐字相同。
- assignmentSnapshot与iteration-1 task-events中同task对象深比较一致，包括Agent 2.0.0/hash e999616a126c2cb1、code-review绑定、空tools.allowlist及network/write/externalWrite=false。没有证据显示本次靠换包、改材料或放权完成。
- receipts.executionEvidence与live.task按本run过滤所得一致：toolCalls=[]；本run transcript无tool消息，retry事件17—24无工具事件。**live.session.run.toolsUsed/steps仍含第一次失败的fabric_search等历史项，不能误计为本次调用。**
- 平台gateStatus=verified只说明平台运行门禁结果，不替代以下专业评价。本次0tools也不是需求测试已动态执行的证明。
- SOP在实际user文本可见；本题交付的requiredSkills为空，采证并非完整system/L1装配证书。不能把评分直接解释成code-review Skill的独立效果，也不能把方法失误一概归咎于平台装配。

## 原五断言逐项评分

行号均指 skill-evals/professional-batch3-workspace/iteration-2/QA01/baseline/outputs/answer.md。

| # | 冻结断言要点 | 结果 | 依据 |
|---|---|---|---|
| 1 | 全部新用例未执行，日志仅材料，不报动态通过率/验收通过 | PASS | 第3行明确全部静态设计、未执行；TC4第14行虽用“日志L部分佐证”作状态，但仍受全局未执行限定，并补无DB计数，未写亲自执行通过 |
| 2 | 同键同T及done不证明DB唯一、文件正确、权限安全 | PASS | 第3、24—25行明确缺DB计数、文件及其他路径验证；“弱证据/与规则一致”没有升级为证明唯一，且明确不能排除短暂多实例 |
| 3 | 成员/管理员隔离及越权请求，身份资源和预期清楚 | PASS | TC1/TC2第11—12行明确A/B和a/b；A不得获得b、B应得a+b，具备可观察检查 |
| 4 | 并发、超时、24h边界；不新增未定过期键规则 | FAIL | TC3/TC4覆盖并发及超时；但TC5第15行要求>24h允许新建T且不复用旧T，原材料没有这一窗口外规则 |
| 5 | 刷新与取消完成竞态，已下载豁免及证据不足结论 | FAIL | TC6—TC8及第29行保留刷新/旧文件/证据不足；但取消已成功后的下载检查与先下载再取消，不覆盖取消/完成竞争 |

分数按冻结复合断言整条计，不给半分，不事后修改断言。对未被五项完整覆盖的额外问题另记claims，不篡改冻结分母。

### 为什么第1条不是因TC4状态栏而失败

第3行“以下用例均为静态设计，执行状态：未执行”适用于TC4。第14行“日志L部分佐证（同键→同T→done），但无DB计数确认”是引用材料，不是模型宣称执行过该用例。将其判作动态通过会忽略全局明示条件。

更清晰的列值应是“未执行；L部分佐证”，但这是状态展示改进，不是本轮虚构执行的证据。本报告的60%是**静态输出断言通过率**，绝不是被测产品的测试通过率。

## 必须区分的事实、推断、建议与遗漏

### 1. TC5：窗口外新建/不复用是补造测试规则，不是已运行事实

R2只约束同键在24小时内最多创建一个任务；对窗口外可以新建、继续复用、拒绝或要求新键未作规定。TC5把“允许创建新任务T'，不复用旧T”放进可观察预期，没有标为建议、候选或待决策，因此验收判据越界。

这不是说模型虚构了某次新任务已经创建，而是它把**未定义业务规则写成必须满足的验收预期**。最小改进：用受控时钟覆盖明确窗口内的幂等边界；窗口外及恰在临界点的契约不明确部分列待澄清，不能替业务挑一种方案。原文没给过期策略，不应为了写满8项而补规则。

### 2. TC7/TC8：前后状态不等于取消完成竞态

TC7前置已经取消成功，只检验之后下载是否被阻止。TC8前置已经下载，再取消并检查本地文件。两者都没有让完成结果与取消请求/确认交错。

最小竞态设计应是：控制任务在接近完成时并发发起取消与完成回执；**若取消成功已确认**，迟到done或新结果不得把任务重新变成可下载。若完成先胜出且取消未成功，原材料没有要求取消必然成功，不能一律判失败，也不能新定最终状态优先级。已经下载的文件不要求追溯删除仍保留。

在<=8项约束下，可把已下载文件豁免并入取消用例，再用一项测试时序交错，无需扩写长测试计划。

### 3. TC3/TC4：材料日志的观察不能无条件推广为所有请求的保证

- TC3要求并发两个请求都返回202+T：L只展示顺序重试的202+T，R2的强约束是最多创建一个任务，没有完整规定并发时HTTP响应契约。“不新增任务”有据；“均202”需协议依据或明确条件。
- TC4要求GET T最终done：L证明本例最后是done，不证明任何后台任务都必成功。可以在“受控任务随后正常完成”的前置下测试恢复到done；否则只保留复用原任务、无新增和真实状态恢复。
- “两个客户端同时POST（间隔<1s）”给了测试动作，但<1s不保证服务端请求重叠。可靠的并发用例应以同步起跑/阻塞点控制重叠，避免顺序执行也被当成并发覆盖。

这些是测试判据和可复现性问题，不是模型声称已经完成动态执行。

### 4. “自动化脚本尚未覆盖”超出材料范围

第33行没有脚本清单、代码访问或覆盖报告支持。缺覆盖证据不等于真实脚本不存在覆盖。应表述为“未提供TC3/TC5自动化覆盖证据”。材料中的“无法访问代码/测试环境”尤其不能作为反向证明。

第25行“R1、R3完全无证据”紧跟解释日志没有相应事件，合理读法是**缺执行证据**，不是说R1/R3需求条文不存在；不做脱离上下文的字面扣分。

### 5. 合法建议不当作虚假事实

- TC1的403或仅返回a、TC7的403/404或明确取消提示，是满足安全约束的候选实现/响应，不是原材料已经指定的唯一协议值。不因出现原文未给的HTTP码就自动判造假；需强调实际不得泄露b/不得返回取消任务新结果，不能只凭提示文字验收。
- 第35行“最低放行门槛”明确在发布建议章节，且说留证后“方可评估发布”，不是声称业务已批准或四项做完即自动通过。因此不计虚构政策。
- 但该建议将刷新、超时恢复和窗口边界推迟下迭代，遗漏取消竞态，对这些已给关键风险缺少推迟依据/风险接受条件；应说明尚不能由四项覆盖代表R2/R3全部风险关闭。评价建议的充分性，与断言它是假的既有政策，是两回事。
- TC8保留不追溯删除的方向，符合本题边界；操作最好观察本地F和取消后新结果下载，而不是未经说明假定服务端具备删除本地文件的机制。

## 长度与交付数量

实际8条用例，没有超过8条。全文包括标题、表格、证据说明和发布建议：

- 汉字：665；
- 汉字+字母数字块：755，未超过800；
- raw Markdown字符：1250，只作原始大小记录，**不作为超长判据**。

沿用batch3计数式：

    text.match(/\p{Script=Han}|[A-Za-z0-9]+(?:[.,/][A-Za-z0-9]+)*/gu).length

该启发式排除Markdown/标点，并非编辑器官方字数。输入未冻结官方计数器，因此不另换口径追罚。当前证据支持“本批口径下未超限”。

## 最小通用改进及未见题rubric

不建议为扩写Skill而扩写；仅需交付前做三项核验：

1. 每条预期标清来源是已定规则、材料本例观察还是待决策建议；不把有时/本例变成所有执行必须如此，不补窗口外规则。
2. 恢复用例区分稳定状态和交错时序；以取消成功等已给前提绑定安全断言，不替业务发明竞态胜出规则。
3. 执行状态与材料证据分列；缺资料不能反推脚本/实现不存在。发布建议保留建议身份，并列出延后关键风险的条件。

下一轮留出题可换不同幂等窗口、临界时间和日志状态：要求窗口内保证准确、窗口外待定、日志仅支持本例；再给取消/完成双时序，检查取消成功后的晚结果不可复活。先冻结这些rubric再跑，不回改本题输入/输出，也不把此次平台恢复视为方法优化的因果实验证据。

## 冻结文件与校验

新增grading保留原五断言逐字文本、任务/run绑定、逐项证据和source_sha256。收尾仅运行JSON解析、评分统计/断言一致性及冻结文件hash校验，不运行产品测试或真实服务。iteration-1的N/A评分保持不变。

- evidence/professional-batch3-inputs.json: `0e523b3a791f735600c6c1c95af06402ed771bd3aaa709de57b3198e58f7bf9f`
- evidence/professional-batch3-task-events.json: `5094ffab0eafde1bb1d6dcbb7ffe6ec959e28d73d53a6f8298a1a3d22ff16549`
- evidence/qa01-retry-live-2026-09-06.json: `36716a1c69076eef58ff4d08326141289c04d80638e07cffd904e36db2abc070`
- skill-evals/professional-batch3-workspace/iteration-1/QA01/eval_metadata.json: `7fe6fbef034bd5fad9682705d505a09a40f7fc6048b779a2bba90894f4ac9ad7`
- skill-evals/professional-batch3-workspace/iteration-1/QA01/baseline/grading.json: `032e49c60892d3c735286ef14c68a188d540d392d0d1a4b8a4e28b08fdbd5f7c`
- skill-evals/professional-batch3-workspace/iteration-2/QA01/baseline/outputs/answer.md: `a5c00024eeb14854865d3cf76cec859e8d780b34a8e54806439258b21d76bd1a`
- skill-evals/professional-batch3-workspace/iteration-2/QA01/baseline/outputs/receipts.json: `e8cc3da4ece402ebfd8a5484bb6ec34237ca4b75429cebd5395a9b6da9a3311e`
- skill-evals/professional-batch3-workspace/iteration-2/QA01/baseline/transcript.json: `0894cb8ea34742e84713f09e4f567a785e52ec2fe183a5f7f49d0cfac5d605db`

