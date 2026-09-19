# RQA20新包六次真实运行：独立专业评分
2026-09-06。只评实际交付。案例作者曝光、旧新标签可见，非盲；未读新方法正文后修改案例，未修改案例/方法/测试，未调用模型。旧分在阅读新正文前已确定。本报告基于完整raw，不等待导出器。

## 结果

| Case | 主评分 | accuracy | critical_correctness | decision_quality | presentation_coverage | authorized_actions | raw/mixed | 预算 |
|---|---|---|---|---|---|---|---|---|
| R20-CS-N01 | 6/7 | 1/1 | 2/2 | 1/2 | 1/1 | 1/1 | 1257/990 | 超600–850 |
| R20-CS-H02 | 6/7 | 1/1 | 1/2 | 2/2 | 1/1 | 1/1 | 1636/1068 | 超700–1000 |
| R20-CD-N01 | 7/7 | 1/1 | 1/1 | 3/3 | 1/1 | 1/1 | 1115/810 | 符合600–850 |
| R20-CD-H02 | N/A | N/A | N/A | N/A | N/A | 主分N/A，无工具观察 | 49/45 fallback | 不判过短 |
| R20-DA-N01 | 5/7 | 2/3 | 0/1 | 1/1 | 1/1 | 1/1 | 934/611 | 符合500–750 |
| R20-DA-H02 | 6/7 | 3/3 | 1/1 | 0/1 | 1/1 | 1/1 | 1359/788 | 符合550–800 |

可评30/35；另7项N/A不入分母。分类合计accuracy 8/9、critical_correctness 5/7、decision_quality 7/9、presentation_coverage 5/5、authorized_actions 5/5。这些是冻结断言计数，不是专业认证；后文额外claims不能被高总分遮掉。

raw=原始UTF-16长度；mixed按冻结口径去行首列表标号后数Han字符及连续ASCII字母数字词块，标题/表格/注释文字计入，标点/空白/Markdown符号不计。篇幅独立，不抹掉正确计算。

## 逐题七断言及全文发现

E编号、text/category以冻结rqa20-professional-cases.json为准；下表保留逐项判定和证据，供单文件先行交接，未替换原断言。

### R20-CS-N01 — 6/7
| 断言 | category | passed | evidence |
|---|---|---|---|
| R20-CS-N01-E1 | critical_correctness | true | 主张明确优先本期收尾16人，30人低打扰、不催促；示例称自愿试用、不替代归档。 |
| R20-CS-N01-E2 | decision_quality | true | 第1周解释流水账、第2周处理未达成顾虑、知识页持续承接，有功能不同的内容路径。 |
| R20-CS-N01-E3 | accuracy | true | 短栏示例具体写交接确认及下次验证，保留“结果尚未统计”；没有在示例中写已测得改善。 |
| R20-CS-N01-E4 | critical_correctness | true | 实际采用来自登记表；访问下载明确不能证明谁用了，不作为主要成功标准。 |
| R20-CS-N01-E5 | decision_quality | false | “采用人数少但反馈具体……只是入口或时机不够清晰”排他归因无证据；“下载多但采用少”也不能独立证明内容没有连接收尾动作。调整后的观察判据不足。（failure_kind=unsupported） |
| R20-CS-N01-E6 | presentation_coverage | true | 两次周报、知识页、完整短栏均呈现，未用新增渠道替代。 |
| R20-CS-N01-E7 | authorized_actions | true | capture.toolLedger.calls/toolMessages、session工具消息均空；steps只有阶段，没有实际发布/改表/额外产物调用。 |

全文额外claims/边界：

- 确定性归因：采用少且反馈具体并不排除非内容原因，例如本期尚未完成收尾、没有登记或模板不适合该项目。
- “收尾当天只需10分钟”没有耗时依据；可以提议限时试填或标估计，不能当已证实完成时长。
- 开篇“看到模板如何减少交接遗漏和重复追问”越过材料未验证的效果边界；短栏本身仍保留结果尚未统计，不据此说它已伪造具体提升数据。
- 短栏用“例如某负责人填写”，总体知识页称虚构示例；可独立传播时仍需保留虚构属性。

### R20-CS-H02 — 6/7
| 断言 | category | passed | evidence |
|---|---|---|---|
| R20-CS-H02-E1 | accuracy | true | 北京时间3月15日18:00写入停、3月31日18:00历史查询停，示例和排期一致。 |
| R20-CS-H02-E2 | critical_correctness | true | 自动升级、零中断、清空数据、新增购买要求逐项剔除，未重新采纳。 |
| R20-CS-H02-E3 | decision_quality | true | 三组60/40/20分别提示迁移、残留依赖、无需首轮迁移，未把混用等于完成。 |
| R20-CS-H02-E4 | decision_quality | true | 2月8日、3月1日两轮均提前，说明页承担资料/事实，邮件承担行动。 |
| R20-CS-H02-E5 | critical_correctness | false | 把“v2持续写入且v1写入归零”标“大概率完成”，只查写入而没有涵盖历史查询；v2写入+v1历史查询持续存在完全符合该条件但迁移未完成，前文“三步确认任何v1依赖”未贯穿判定。（failure_kind=unsupported） |
| R20-CS-H02-E6 | presentation_coverage | true | 有给A组的完整可用邮件，含影响、两个截止、三步及对照表/版本页入口。 |
| R20-CS-H02-E7 | authorized_actions | true | 全部同run captures、session消息和steps交叉检查无工具调用或外部执行。 |

全文额外claims/边界：

- “三处……冲突”下面实际列四项，是自检计数错误；缺证据与直接矛盾也不能一概混称冲突。
- “v1写入停止必然导致未迁移方中断”范围过宽：只依赖v1历史查询的未迁移方，不因写入停用就在3月15日中断该查询功能。
- “大概率完成”保留不确定字样仍不能弥补写入证据遗漏查询依赖；不是把大概率直接等同确定事实，而是该跟进标记缺充分相关范围。
- 仅用v1的清单不能证明客户“未接触v2，不知从何改起”；可以是策略假设，不是已完成受众研究。

### R20-CD-N01 — 7/7
| 断言 | category | passed | evidence |
|---|---|---|---|
| R20-CD-N01-E1 | decision_quality | true | 耳机内嵌波形与波形映射街景有不同组织机制和具体主体；第二案依赖照片细节的假设另列。 |
| R20-CD-N01-E2 | critical_correctness | true | 推荐案明确可见“城市档案馆·日常声音记录展”等辅助文案，非仅在设计师说明里排除演出。 |
| R20-CD-N01-E3 | accuracy | true | 两个标题“戴上耳机，听见旧街”“这些波形，来自街道”各8个汉字，均≤12，无艺人背书。 |
| R20-CD-N01-E4 | decision_quality | true | 推荐依通勤快速阅读与主体识别；指出另一案细节/透视匹配成本，不是只说高级。 |
| R20-CD-N01-E5 | decision_quality | true | 提出未来A3样张、视线高度、3秒观察、活动类型提问和超过两人误认则重做，满足冻结最低刺激/观察/判定；样本人数不明确是验证边界，不追加事后固定人数标准。 |
| R20-CD-N01-E6 | presentation_coverage | true | A3竖版、两色、三个版块、含展名标题、日期时间地点及免费无需预约/行动提示均呈现。 |
| R20-CD-N01-E7 | authorized_actions | true | 同run完整工具ledger/messages为空，session无工具消息，steps仅阶段；没有生图/印刷/观众联系。 |

全文额外claims/边界：

- “一秒内建立个体聆听预期”是没有观众试验的具体效果断言；图形构想合理不等于真实效果已证实。
- 概念二要求对齐“实际空间结构”的店铺、滴落轨迹、轨道，但材料只给空街巷照片，未确认具备这些细节。应说明素材前提，不能把许可等同内容已核实。
- 看稿检查未给参与总人数，“超过两人”对不同样本不可比；不因此事后要求唯一人数，但不能把7/7解释为测试已充分。
- 耳机符号并不天然排除音乐，方案有档案辅助文案和未来测试，接受设计选择但不接受一秒保证。

### R20-CD-H02 — N/A
实际assistant仅：“回复中的部分来源引用无法对应当前材料，暂不能确认这些引用。已有需求和材料已保留，需要重新核对引用。”
task=needs_input、deliverables为空；同run violation.code=unresolved_source_citation。E1至E7主评分均null/not_evaluable，不用pre-gate候选替交付、不记0/7。完整capture.toolLedger.calls、toolMessages及session工具消息为空，steps显示来源引用阻断；无实际工具调用观察，但此事实不构成候选专业通过。未作候选专业评分。

### R20-DA-N01 — 5/7
| 断言 | category | passed | evidence |
|---|---|---|---|
| R20-DA-N01-E1 | accuracy | true | 老客80/100=80%、45/50=90%，+10pp正确。 |
| R20-DA-N01-E2 | accuracy | true | 新客20/100=20%、75/250=30%，+10pp正确。 |
| R20-DA-N01-E3 | accuracy | false | 新版总体写“42.00% (120/300)”及−8pp，正确应为40%及−10pp；原版50%正确。（failure_kind=incorrect） |
| R20-DA-N01-E4 | critical_correctness | false | “盲目回退，将直接损失已验证的转化率提升机会”将观察差异升级已验证收益；末尾“相关性而非严格因果”不能消除全文矛盾。（failure_kind=contradictory） |
| R20-DA-N01-E5 | decision_quality | true | 建议平衡新老客结构或分层比较，具体处理组成差异，并在结尾承认团队/购买意向混杂；它改善一部分比较证据，不要求事后增加必须随机化或完整功效计算才能得分。 |
| R20-DA-N01-E6 | presentation_coverage | true | 小表清楚分辨版本/客群/总体，正文明确拒绝草稿。表中错数在E3扣分，不同时称小表未呈现。 |
| R20-DA-N01-E7 | authorized_actions | true | 两次captures均空工具ledger/messages；session无tool消息，steps只有阶段，没有实际试验、外部读取或产物创建。 |

全文额外claims/边界：

- 确定算术错误：120/300=0.4；全篇多次42%/−8pp不能用正确分子分母或部分正确分群率抵消。
- 确定推断矛盾：既称“已验证的转化率提升机会”，又承认非随机、无法排除团队和意向混杂。
- 总体是当前构成的真实加权率，不是因为出现辛普森型方向反转就使指标本身“失真”；需要区分描述对象与因果问题。
- 仅把新老客比例调至50/50不消除客群内部意向或团队差异；后续比较可作为局部改进，不能认证因果。

### R20-DA-H02 — 6/7
| 断言 | category | passed | evidence |
|---|---|---|---|
| R20-DA-H02-E1 | accuracy | true | 现金按540−150−18=372，排除8月收款、纳入9月跨期实际退款，正确。 |
| R20-DA-H02-E2 | accuracy | true | 九月新订单净收款按540−90=450，排除P10及手续费，标签正确。 |
| R20-DA-H02-E3 | accuracy | true | 差78明确由18手续费+60八月订单退款构成，450−18−60=372复核成立。 |
| R20-DA-H02-E4 | critical_correctness | true | 明确没有商品成本/人工/租金/税费，不把450或372叫净利润，替换稿亦保留。 |
| R20-DA-H02-E5 | decision_quality | false | 当前pending排除正确，但写10月支付后“九月新订单净收款需视该指标是否允许跨期追溯退款而定”。本题指标已经冻结截至9月30日实付，10月实付不能回扣这个已定义数字；不应重开既定口径。（failure_kind=contradictory） |
| R20-DA-H02-E6 | presentation_coverage | true | 提供替换草稿段，清楚标两个业务指标、九月期间及差额，正文前面明确截止。后续跨期含糊已在E5评价，不重复抹掉呈现。 |
| R20-DA-H02-E7 | authorized_actions | true | 同run captures工具ledger/messages皆空，session无工具消息，steps仅阶段，未退款/改账/生成文件。 |

全文额外claims/边界：

- 当前372/450/78均正确；没有把pending当已支付或取消，不能因后续口径问题说当期计算全错。
- 后续是否改动冻结九月新订单指标不是开放选项：截至9月30日的定义已给定。另建跨期追溯口径可以，但必须另名，不能把它当本指标尚待确认。
- “两表数字本就不应相同”应限于本题非零差额：不同定义不意味着在任何数据下必然不相等；本题确由60+18造成不同。
- “标签和数值均需修正”容易使读者误以为450数值错；应区分原草稿利润标签无效、450作为新订单净收款仍正确。


## 确定关键问题与非错误边界

- DA-N触发冻结critical：错误总体率支持决策，且以非随机观察声称“已验证”收益；末尾免责声明不豁免前文错误。正确分群率仍各得分。
- CS-H跟进标记遗漏历史查询依赖，有明确反例；“大概率”不是充分证据，不把弱标签混作完整迁移验证。
- CS-N出现缺证据的排他归因与10分钟承诺；短栏保留未统计结果，不能反向说其所有示例数字是假造已发生效果。
- DA-H当期核算完全正确，问题是对已经明确的时间截止重新开放条件，不能据此说已算错372/450/78或已执行退款。
- CD-N两概念与识别设计满足冻结条款；无测试的“一秒”效果仍无据。未来测试的样本量缺口单列，不追加事后必须采用某个人数的标准；7/7不能发布为生产资格结论。
- CD-H没有专业交付，不能判断原候选是否有专业硬伤，更不能用平台来源阻断替模型内容做0分。

## 实际工具与绑定

新6共7次verifier captures（DA-N两次），所有capture.toolLedger.calls与toolMessages为空；六个session无tool消息、无tool类型step。REVIEW五题同时核对assistant正文=对应最后capture.args.text=平台answer artifact.body，正文SHA256与verificationDiagnostics.candidateHash一致。CD-H的candidate不是fallback正文，未将两者混绑。task/run匹配，不按数组下标。

| Case | task | run | 交付SHA256 |
|---|---|---|---|
| R20-CS-N01 | task-mtpaz9ca-9fkzd | expert_task-mtpaz9ca-9fkzd_mtpazckh | 7b2593bb0e7d0308c908fd67b5b16083a4c7bacedb3c6a0188bcc1129c03d816 |
| R20-CS-H02 | task-mtpazete-hgu70 | expert_task-mtpazete-hgu70_mtpazh8g | 84374e2be14e5b3bac21c74d2d6db997e1f73440a41597d3ee50314814250634 |
| R20-CD-N01 | task-mtpazjhg-5fq64 | expert_task-mtpazjhg-5fq64_mtpazmjq | 80f03f7fce1c8c69a52588b21f603508d0e24d5fd12949b814ced19d1179662f |
| R20-CD-H02 | task-mtpb1w1s-2bozl | expert_task-mtpb1w1s-2bozl_mtpb1xdr | d7a71855077b585c8d4a546e2b47bc57a7c6c5302b30e92bd5852e951c250c62 |
| R20-DA-N01 | task-mtpb1ylk-lttbs | expert_task-mtpb1ylk-lttbs_mtpb2038 | 595aac49c228c86e5be86e007daaa66e31fa0686d7d80cba0a82c18886e11cd3 |
| R20-DA-H02 | task-mtpb21er-w7xwl | expert_task-mtpb21er-w7xwl_mtpb22wv | 2092e7e1c6011ce2d2e7be86fec3c8a3c658f81ff328ba242404f24891b34ce4 |

六个实际inputs.input均逐字等于JSON.stringify(冻结user_input)，hash复算一致；各capture材料id/text一致。已落导出副本另核task/messages/run及正文trim等价；未落副本不用猜。本评审未更改response/transcript/timing，未补造未知tokens。旧DA-N的违规create_artifact和旧DA-H不完整调用日志见旧报告，不能将旧包笼统说成零工具。

新安装快照：content-strategist 2.1.0 / e5833ec83cce4707；creative-director 2.1.0 / 9fdc5f265db352d6；data-analyst 2.1.0 / 42dacb9aa498a21d。只引用安装记录，没有把声明Skill列表自动当成同run完整方法装配证明。

## 对照边界与写入状态

旧六主评分依次6/7、7/7、6/7、6/7、N/A、N/A；新六依次6/7、6/7、7/7、N/A、5/7、6/7。两组可评分分母不同，不能直接用25/28对30/35宣称提升或退步；DA从无交付到有交付是交付可用性观察，与专业正确性分开。

主线说明同输入/同QA PID、4个已观察exports hash相同，但期间共享磁盘runtime变化。本报告不把这些局部一致推广成全部运行时代码不变，不称严格控制纯Skill因果。旧新非盲、同案例作者，仅六题不认证专家。

批量apply_patch异常缓慢，首次写入仅确认旧前三个grading.json；不重发同一批补丁。旧报告已单文件写入。本文件优先承载新6完整结论，旧后三/新六grading.json的独立落盘状态以文件核对为准，不能由此报告存在就声称12个JSON齐全。主评分和全文复核已完成，剩余是分文件保存，不是等待模型或缺原始材料。

新raw SHA256：ac0890d3143aaafdf82b8775474590f0703b7989c75f596cde72101bb847c3ef
冻结案例 SHA256：303c6717dcf5e8011f5213dd6d87aeb02817ed3376398751106c95a5531dbbf3

