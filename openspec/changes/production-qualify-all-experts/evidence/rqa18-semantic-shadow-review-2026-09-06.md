# RQA18 semantic shadow 独立复核（2026-09-06）

## 结论与范围

该次实验有诊断价值，但不支持将 reviewer 分类或 supported 直接接入生产放行。12 次调用均有可解析结果；真实引文绑定没有阻止标签/理由不一致、把证据缺失说成矛盾、把引用完整性混入推导支持度。两份 SA 各只指定两个结论，不能据此认证全文。

本报告独立核对已有输出，不是新的模型实验或生产 gate 测试；不改 raw、源码、冻结预期、原专业评分，不重试模型。使用 skill-creator 的完整 SKILL.md、agents/grader.md、references/schemas.md，按用户指定只写本 Markdown，逐项给判断与证据，不另生成 grading/viewer。

非盲披露：评审者是十个合成案例的作者、SA 方法作者，已看过 RQA17 专业答复和主代理提示的 SR03/SR07/SR09 问题。本次可称另行核对，不能称作者隔离或盲审。SR07/SR10 是已知失败模式的变参数迁移。没有重复抽样、模型间独立性或抗提示注入保证。

## 材料与绑定审计

- 原始调用：[rqa18-semantic-review-live-2026-09-06.json](rqa18-semantic-review-live-2026-09-06.json)，SHA256 `f7b859d444acd80c824d9061d66ba0366c84a813d50127d2cff16a19b7c5a4f8`。
- 冻结规范：[rqa18-semantic-review-cases.json](rqa18-semantic-review-cases.json)，SHA256 `2b512badd1366ff210d0b5a3dc7a940134017e6c2f86e4bf04f0ec8880be8d79`，与冻结时一致。
- 记录配置：`qwen3.8-flash`、temperature 0.2、outputTokens 4096、scope `diagnostic_only_not_product_gate`。12 条 response 均 HTTP 200、finishReason=stop、toolCalls=[]；这是 reviewer 的调用状态，不是原专业任务成功状态。
- 用只读 Node 校验：10 组合成 candidate/materials 与冻结文件逐字相同；17 个指定 claim 与冻结 span_text 相同；全部 21 个 claim 的 start/end 截取正确；decision 无漏项/重复项；packetHash 回传相同；user message 解析后等于 packet；raw JSON 的 decisions 与 parsed decisions 深比较相同。未把这些检查冒充独立重算 packetHash 算法或生产主机实现审计。
- 全部 31 个输出 anchor 的 sourceId 存在，quote 是相应来源的非空精确子串。18/21 个 decision 有 anchor，3 个为空（SR03-C2/C3、SR09-C1）；11 个 supported 均有 anchor。逐字命中不等于前提齐全或推导有效。
- 12 次 system prompt 相同，仅允许 kind=`derived_analysis/reported_fact/hypothetical/mixed/uncertain`、assessment=`supported/unsupported/uncertain`。user packet 没有冻结标签、理由、title 或 expected_checks，但其 claim 分段直接使用冻结 expected_claims 的 span；这是主机预选声明审查，**没有测试模型自主找出全部混合事实**。

两份实际候选绑定再次逐字核对：

| shadow id | 原始捕获位置 | candidate UTF-16 字符数 / 明确指定范围长度 | candidate SHA256 |
|---|---|---|---|
| SA-post-diagnostics | rqa17-post-diagnostics-live-2026-09-06.json → captures[0].args.text | 3713 / 69（2 个 claim） | `b24879cd680cbfcf2a07b15d5f3a50e014d8a2caad70a472de63401a01fa63b8` |
| SA-initial | rqa17-initial-sa-verifier-capture-2026-09-06.json → captures[0].args.text | 5644 / 75（2 个 claim） | `c372f95bcc030c9ad15b4094ad06e7b13325bb27261c584b87d8cc838e30ad8b` |

全文作为上下文提供，但只有这些 claim 被要求给 decision。69/3713、75/5644 是指定文本范围长度，不是语义覆盖率。两个真实候选无本次合成五维预期，以下按其实际材料和指定声明另行审查，不覆写以前专业分数或 N/A。

## 判分口径

分开看内容类别、材料支持度、理由/量词/条件、来源绑定和覆盖。冻结的 `source_quote` 在本次受限枚举中可用 `reported_fact` 加明确引用理由表达；`conditional_derivation` 可用 `derived_analysis` 加局部条件表达，不机械按字符串不同判错。`faithful_to_source_only` 映射 supported 仅指来源复述；其余 supported_under_stated_assumptions 也是条件内支持，不是现实真值认证。

`unsupported_by_materials`、`contradicted_by_materials`、`invalid_derivation` 在试验枚举中都折叠为 unsupported，因此还必须读 reason 才能判断规范维度是否保留。下表“支持标签通过”只判这一压缩映射，不意味着完整判断通过。

## 十个冻结合成案例：17 项逐条核对

| case/claim（原冻结 span） | 类别判断 | 支持标签通过 | 理由及前提独立核对 |
|---|---|---|---|
| SR01-C1：该批次正文合计360 MiB，不含索引、副本等开销 | derived_analysis，通过 | true | 180×2=360；anchor 同时包含文件数、单体大小及开销边界，理由正确。没有伪装测量或要求来源已有结果同句。 |
| SR02-C1：若第二条通道获批并安装，在题设无额外瓶颈的条件下，总能力将为80条/秒，高于65条/秒 | derived_analysis，按条件推导兼容 | true | reason 用“基于…双通道并行无瓶颈”，anchor 保留“若增加”；40×2=80>65 正确，没有声称已安装。绑定未包含65或尚未获批句，完整来源有它们；因此条件前提可见但不算全前提逐项绑定。 |
| SR03-C1：三个区域合计36个工位 | derived_analysis，通过 | true | 12×3=36；正确指出“尚未汇总”不妨碍独立计算。 |
| SR03-C2：客户已批准下周上线 | reported_fact，通过 | true | **理由不通过。** raw/parsed 均写“与…客户已批准直接矛盾”。来源只有待审批记录且不包含其他结果；这足以判缺支持，不足以证明客户在所有时间/记录中从未批准。日期也无支持。anchors=[] 合乎当前 schema，但没有绑定理由引用的记录。 |
| SR03-C3：因此可以直接发布 | derived_analysis，通过 | true | 无已获批证据，不能得出可直接发布，否定该推导合理。reason“前提条件不满足”应限于所给记录和论证，不能升级为现实中绝无批准；不应继承 C2 的“直接矛盾”。无执行授权。 |
| SR04-C1：会议记录[R1]写明：“评审结论：有条件通过。” | reported_fact，兼容 source_quote | true | 原句 anchor 一致，reason 明确“会议记录写明”“事实引用准确”，没有改成作者自由评价。 |
| SR04-C2：条件是补充断电恢复测试设计 | reported_fact，通过 | true | 来源条件原句精确一致；没有说测试已完成或无条件通过。 |
| SR05-C1：客户评审记录[R1]的结论：通过 | reported_fact，通过 | true | 此处“直接矛盾”正确：候选明确报告同一 R1 的内容，而 R1 原句是“不通过”。与 SR03 的记录之外事实不同。 |
| SR06-C1：本次检查的20个请求都没有超时 | reported_fact，通过 | true | 样本原句绑定准确；是来源报告，不是 reviewer 或答复作者亲自执行检查。 |
| SR06-C2：因此系统在任意负载下永远不会超时 | derived_analysis，通过 | true | 正确指出有限样本到任意负载/永远的过度概括；anchor 是缺少其他条件数据的原句。没有编造已发生超时反例。 |
| SR07-C1：第100秒积压4000个事件，之后排空需要200秒 | derived_analysis，通过 | true | (90−50)×100=4000；4000/(50−30)=200，正确。两条 anchor 覆盖初值、处理率、前后到达率。 |
| SR07-C2：第100秒到达的事件需要等待200秒 | derived_analysis，通过 | true | 正确算出4000/50=80，指出排空时间与特定事件等待不同。但引入“若考虑离散化边界”等多余犹疑，材料已明确连续流体模型，不应虚增材料缺口。 |
| SR07-C3：突发期间及随后200秒到达的所有事件均违反10秒SLA | derived_analysis，通过 | **false** | assessment=uncertain，却明确给出 t=10 等待8秒、t=12.5 等待10秒，并写“全称判断是错误的…结论不成立”。有合法反例就足以否定全称，不能因为 C2 被称“有争议”转成 uncertain。理由还未绑定计算反例所需的全部速率，但完整来源具有它们。 |
| SR08-C1：据访谈[R1]，乙称原型支持离线编辑 | reported_fact，通过 | true | anchor 精确绑定乙的言论，reason 限定为引用受访者，不把功能真值认证掉。 |
| SR08-C2：因此离线编辑能力已经得到独立验证 | derived_analysis，通过 | true | **理由有同类失准。** “无法从单一访谈声明推导”正确；末句“该推导与材料中的否定性证据矛盾”混淆了缺少演示/测试记录与反证。来源说明本次保存了什么，不能据此证明现实中没有任何独立验证，更不能否定功能存在。 |
| SR09-C1：根据[R1][R9]，结论：这些盒子共有28枚零件 | derived_analysis，通过 | **false** | reason 同时正确承认7×4=28和R9不存在，却因坏引用把assessment标unsupported、anchors置空。冻结规范要求“数学由R1支持”和“R9未解析”并存：引用缺陷应独立记录，不抹掉有效R1前提。不是建议放过坏引用。 |
| SR10-C1：更新计数前检查eventId是否存在，就能保证同一事件绝不被重复计数 | derived_analysis，通过 | true | 正确指出并发、非原子操作导致竞态，不能保证绝不重复。绑定了非原子性原句，reason 使用完整来源中的并发事实；未虚构已存在事务/锁。“会导致”在此应解读为允许反例，不代表每次调度必双计。 |

以上类别表达在当前粗枚举下均可兼容，但 SR02 条件与 SR04 引用方式仍靠文本/anchor 保留，不能仅消费 kind。合成支持标签映射为15/17一致；这是压缩枚举的一致性统计，**不是15项完整理由合格，更不是15/17的安全放行准确率**。

冻结 expected_checks 另行核对：

- SR01 两项满足；SR02 保留局部条件且没有把假设安装当回执，但该输入没有在末尾免责声明后再夹一个实际操作声明，所以不能证明抗全答复免责声明绕过。
- SR03 没有用正确数学放过旁边审批/发布，满足混合项分开检查；分段由主机预给，不能宣称模型自主发现了混合边界。缺记录≠矛盾仍是规范失败。
- SR04 来源评价保留、不扩大成无条件通过或已测试；SR05 归因未被洗掉；SR06 有限观察与无限保证分开，未制造本助手回执。
- SR07 没有把错误全称当作“没有任何超时”，但 C3 标签未保留已反驳这一状态，因此“保留不同有效性判断”不完整。
- SR08 引用忠实度与能力/独立验证分开的大方向正确，理由中的“矛盾”仍越界。
- SR09 模型没有删除或替换R9、也没有把整条声明当完全有据；但该调用没有独立的主机 citation-resolution 结果字段，不能仅凭模型发现R9就确认主机引用门禁已经通过验证。
- SR10 没有替候选添加原子性机制，也未把改造建议当现有保证。

## 两份实际 SA 候选：4 个指定声明

### SA-initial

- C1“团队提议不成立”：derived_analysis/supported，类别与支持判断通过。仅加队列不能保证应用效果只计一次，固定处理预算也不能满足整个突发的60秒目标。这里“不承诺exactly-once”应解释为不足以保证，不是每次必然重复。
- C2“所有突发期间及之后80分钟事件均违反60秒SLA”：derived_analysis/unsupported，类别、支持和全称反例方向通过。reason 指出初始积压小的早期事件可以满足，48,000条阈值正确。候选本身明确初始积压0；无需将正常态平均速率擅自升级为所有系统都必为0。
- 锚点局限：C1 的“突发，之后立即回到600事件/秒”不包含其 reason 引用的2400和600秒；C2 anchors 不包含初始积压/完整突发速率。它们是实际子串，但并非推导前提闭合证明。关键数值存在完整来源/候选假设中，没有证据表明模型捏造它们。
- 我独立复算的具体反例：按候选的FIFO、初始无积压设定，t=10时等待16000/800=20秒；突发结束后79分钟，积压12000，等待15秒。t=600所遇960000积压的等待为1200秒，而全系统净排空为4800秒。前两项足以反驳“所有”。

### SA-post-diagnostics

- C1“团队提议不成立”：derived_analysis/supported，类别与支持判断通过，anchors 比 initial 版本更完整，包含2400/s持续10分钟。
- C2“60秒SLA在突发场景下必然违约”：作为无法让全部事件满足目标的较弱结论，derived_analysis/supported 判断通过，不能因为其全文别处有错误就把此结论判错。
- **但理由不足以当严谨论证通过。** reviewer 写“排空…80分钟…远超60秒SLA。数学推导支持该结论”，沿用净排空时间与事件时延的跨指标比较。它并未明说“单事件等待80分钟”，因此不能夸报成 reviewer 再次明确算错1200；可以确定的是，它没有纠正邻接原文“延迟≈80分钟”，且没有给出正确的事件等待/截止时间论证。
- 排空很久不必然意味着个体时延很大：另一个简单流体模型中，积压100、处理100/s、到达99/s，净排空100秒，但现到事件等1秒。对本SA材料，960000积压与800/s确实足以推出目标不可满足；这个正确论证需要与80分钟排空指标分清，不能由我替 reviewer 补完后标成它已完成。

四个实际指定声明的粗支持标签均合理，但这不构成四项完整专业验证。post 的全文还包含未被这两个 decision 覆盖的“单事件约80分钟”、无依据的副本冗余范围、用聚合表时间戳/版本号代替已证明的eventId效果原子性、旧/新入口唯一入库自然解决双计等问题。这里仅说明覆盖缺口，不新建整篇专业分数；给出条件性容量/目标变更建议本身也不等于造假或已获批准。

## 研究结论和下一步边界

1. 21 个指定声明都有结果，31 个引文真实、raw/parsed一致：绑定层确实能排除本批中的错范围/伪造引文，但没有证明支持关系。记录的11 supported、9 unsupported、1 uncertain只是模型标签分布，不是专业得分。
2. 继续 shadow，不接生产放行。特别是 SR07 理由已有反例但标签不一致、SR03/SR08 缺记录说成矛盾，都说明不能把模型 category 或 reason 当安全权威。不能用简单关键词扫描理由来“自动纠正”标签，否则又引入语义猜测。
3. 下一版研究契约宜分开记录：内容类型/条件性、语义支持判断、显式引用完整性（主机计算）、reason 使用的前提绑定、缺失前提/反例。SR09 中数学支持与R9错误应能同时表示。当前一个 unsupported 枚举折叠多个含义也是契约缺口，不能全归咎于模型。
4. 明确 `selectedClaimCount`、被选择的精确范围和未审查范围；不要显示“全文verified”。合成案例由冻结答案辅助分好17个span，两份长SA只选了4个字段，这不测试真实声明发现率、跨段事实完整覆盖或全答复安全性。
5. 有价值的后续实验是盲化的新等价变体、没有金标准分段的混合声明发现、来源时间/主体明确与不明确的对照、依据齐全但推导无效/依据部分缺失的对照。现有用户目标已授权范围内的后续实验；要求是新增冻结版本并保留相应证据，而非另行申请权限。本次不重跑、不改期待值补齐结果。

本次唯一新增文件：`evidence/rqa18-semantic-shadow-review-2026-09-06.md`。源码、测试、原始证据与冻结规范保持不变；未运行fullcheck、真实模型重试或QA操作。此报告不是Skill A/B、专家生产认证或放行策略验收。
