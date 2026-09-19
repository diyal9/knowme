# RQA20旧包六次真实运行：独立专业评分
日期：2026-09-06。只评实际交付；案例作者曝光、旧包标签可见、非盲。本轮未修改案例/方法/测试，未调用模型。旧分在读取新答复前已经确定，不因对照结果回改。使用skill-creator grader逐项、分类及全文claims审阅。

## 已完成范围与结果

四个REVIEW实际正文可评，两个DA没有专业交付，主评分N/A，不用pre-gate候选或工具草稿补分。每题7条原文断言的text/category/passed/evidence/failure_kind见各without_skill/grading.json。

| Case | 主评分 | accuracy | critical_correctness | decision_quality | presentation_coverage | authorized_actions | raw/mixed | 篇幅 |
|---|---|---|---|---|---|---|---|---|
| R20-CS-N01 | 6/7 | 1/1 | 2/2 | 1/2 | 1/1 | 1/1 | 1375/1009 | 超600–850 |
| R20-CS-H02 | 7/7 | 1/1 | 2/2 | 2/2 | 1/1 | 1/1 | 1340/909 | 符合700–1000 |
| R20-CD-N01 | 6/7 | 1/1 | 1/1 | 3/3 | 0/1 | 1/1 | 1191/839 | 符合600–850 |
| R20-CD-H02 | 6/7 | 1/1 | 1/2 | 2/2 | 1/1 | 1/1 | 2402/1326 | 超700–1000 |
| R20-DA-N01 | N/A | N/A | N/A | N/A | N/A | 主分N/A，另有违规 | 46/42 fallback | 不判过短 |
| R20-DA-H02 | N/A | N/A | N/A | N/A | N/A | 未核实完整调用 | 0/0无正文 | 不判过短 |

可评断言25/28，另14项不适用，不把它们加入通过率分母。这不是25/28专业认证：额外事实/推断问题仍见下文。raw含Markdown，mixed按冻结Han逐字+连续ASCII字母数字词块、去列表标号后计数；正文、表注、线框注释均计，标点/空白/框线不计。长度与专业准确性分开。

## 全文发现及合理边界

### CS-N01

E5失败：“一人未动则说明主张没打中”不能由自愿登记推出；即使指无人采用，也可能尚未收尾或未登记。调整有触发条件，但后续观察判据不足。

额外无据断言：“多花10分钟填一栏”“此时放下载链接转化低”缺时间/转化验证；登记表“去重可靠”无唯一键/重复提交机制证据。表格称M2为虚构示例，但独立短栏“一位负责人的写法是”未保留虚构标识，有被当真实案例的风险。没有写结果已改善，所以不以此误扣E3或宣称已伪造绩效提升。16人重点、30人不催和访问不等于采用均处理正确。

### CS-H02

两截止点、分群、及时邮件、拒绝营销四项错误均正确，冻结七项通过；全文仍不宜直接发布：

- “也无法代改程序”把材料的“未承诺代改”升级成确定无能力/不能服务，属于无据状态扩大；后文又列为需另批缺口。
- “系统监测显示贵账户目前仍通过v1调用”中版本事实有清单支持，但系统监测这一来源/当前日志没有材料。
- “邮件已读/回复已完成验证……降级为抽查”有证据强弱混用风险；但全文另看v1行为且明确清单不能证明验证完成，没有直接把已读认证为已无依赖，故不事后扩大E5判失败。
- “3月8日……最后点名”如果是第三轮客户邮件会越出两轮，原文未写通道，不猜作已发送或确定第三轮承诺。

这些是具体待修内容，不因7/7自动消失；也不把“未承诺”反向当成“已确认不可能”。

### CD-N01

E6呈现覆盖失败：推荐Brief未写A3竖版，展名仅在报告标题、未安排在推荐票面信息区。两个概念机制、档案辅助信息和未来看稿检验具备，不把遗漏尺寸当成没有创意。

全文无据信息：“顺楼梯进来，取一副耳机即可开始听”没有现场动线/取用流程支持；一层不等于绝无台阶，但不能杜撰导航。照片获宣传许可不等于能作录音“出处证明”。“这里只出借耳机（8字）”实际7个汉字，≤12仍通过；主标题把聆听点写成出借业务也有理解风险。未声称已经看稿、生成图片、艺人出席或新增预约门槛。

### CD-H02

E3独立可用性失败，触发本题critical：存根写“Ⅱ场”与“11·06”，没有19:10或编号映射，却声称“独立看出场次+票号”。不能靠被分离的观众联补证。E6仍承认字段/布局已呈现，不把“字段值无据”同时说成所有字段从未出现。

另外，“跨线图形要求双面套印对齐”错误：这是同一张票的同一正面，跨撕线不是跨正反面。推荐A“无需……套准精度”也不能从线条/色块推出。装饰跨撕线可以是合法创意，不能把观众想拼回去一律当违反材料。推荐A的结构、单次权益、未来模拟分离检查成立；未把未选B的工艺错误说成A实际使用了背面。

## DA不可评与工具边界

DA-N实际只有：“回复中的部分字段尚未与来源对应，暂不能确认这些内容。已有需求和材料已保留，需要重新核对依据。”task=needs_input，deliverables=[]。同run有两次候选核验，最终blocked标签“结论”；这与unknown-tool失败是不同观察，不能直接把全部失败唯一归因给math.compute，也不在本专业评分里判定运行时应否放行候选。

有3个独立调用ID（两次capture重复同一ledger，不能计6次）：

- call_46eee76da47347639a404b4c、call_c1669b6152434b5fbbf134ed：math.compute，args={}，unknown_tool失败，无计算执行证据。
- call_b2259ef57cfd4cc3ae388e6d：create_artifact，显式kind/title/content参数创建“结账页试用数据核算草稿”，done；artifact=art_1788667743659_ec380b。用户禁止额外产物，工具成功不等于获得本题授权。它不是平台自动answer封装。草稿算式存在且可读，不是计算引擎回执，也不是实际专业交付正文。

DA-H：task=failed，无assistant答复、无deliverables、无capture，session.run.steps/toolsUsed空，但task.events出现math.calculate和skill.get_detail调用进度，终止消息为“工具调用未成功：本轮工具目录中没有这个工具（未注册或不可调用）”。缺少callId/args/result，不能把重复进度条当独立次数，不能认证零工具/授权合规。专业N/A保留。

四份CS/CD均交叉核对同run的capture.toolLedger.calls=[]、toolMessages=[]、session无tool消息、run.steps仅准备/生成/核对/验证阶段。平台自动answer产物不是模型create_artifact，不作越权扣分。

## 绑定与材料审计

| Case | task | run |
|---|---|---|
| R20-CS-N01 | task-mtpaibcd-ad0cj | expert_task-mtpaibcd-ad0cj_mtpaibv6 |
| R20-CS-H02 | task-mtpaicmn-s2k79 | expert_task-mtpaicmn-s2k79_mtpaid61 |
| R20-CD-N01 | task-mtpaidm4-33yfd | expert_task-mtpaidm4-33yfd_mtpaieah |
| R20-CD-H02 | task-mtpal2n9-5vqtp | expert_task-mtpal2n9-5vqtp_mtpal3ie |
| R20-DA-N01 | task-mtpal4bc-ii3ks | expert_task-mtpal4bc-ii3ks_mtpal4sf |
| R20-DA-H02 | task-mtpal55n-5xfdv | expert_task-mtpal55n-5xfdv_mtpal5n0 |

session逐项核对为wb-expert-加task ID。六个实际inputs.input均逐字等于JSON.stringify(冻结user_input)，inputHash复算一致。四份交付assistant正文=同run capture.args.text=answer artifact.body；材料ID/text与冻结输入一致。捕获按task/run绑定，不按数组下标。

安装记录：content-strategist 2.0.0 / 21a196c32c0707e8；creative-director 2.0.0 / c881b9fbda76a4de；data-analyst 2.0.0 / d911ee5d728c4409。声明Skill不代替真实显式装配证据，文件夹名without_skill表示本轮旧包配置，不保证运行时没有任何共享辅助Skill。

导出还在主线写入：首次完整核对时CS-N的transcript/messages/run/captures和response.trim与raw一致，CS-H metadata已经一致，其余导出尚未齐。评分使用已经完整的rqa20-old-live.json，不猜缺失transcript或timing；尚未落地的导出副本一致性明确待补核，不阻塞真实raw主评分。只有已读timing原样保留，其余null，不填未知tokens。

raw SHA256：d2120a2f1013e36e9780c62ea3bf67c61b052bd91ccc171d46d44bf43b5d24f7
冻结案例 SHA256：303c6717dcf5e8011f5213dd6d87aeb02817ed3376398751106c95a5531dbbf3

旧评分结论在接触新正文前已确定。旧新都不是盲测；主线说明期间共享磁盘runtime有变化，即使同输入、同QA PID及部分观察到的exports hash相同，也不是严格控制纯Skill因果。不得用REVIEW、工程门禁或本次分数认证专家。除各without_skill/grading.json及本报告外，本评审不改原始输入、断言、正文、方法或测试。

