# RQA15 UR-H02独立专业复核（2026-09-06）

**旧版2.0.0：1/5，专业不合格。候选2.1.0：N/A，不是0分。** 本case为1个独立留出题；版本非盲，未参与UR方法作者工作，未读取UR Skill正文进行评分。遵循skill-creator grader/schema，阅读全文、冻结五断言、notes、硬失败条件及两条工具回执；没有改输入、方法或原输出。

## 旧版：正确主表不能抵消全篇问题

task `task-mtp2ggk1-uld13`；session `wb-expert-task-mtp2ggk1-uld13`；run `expert_task-mtp2ggk1-uld13_mtp2ggqc`。与holdout-old-live按task ID核对，transcript、answer、材料和timing一致。五断言为 **失败、通过、失败、失败、失败**。

- A独立完成4/5=80%，B应5/5=100%；答复把B也列80%，尽管下一句承认P5在B独立完成。
- P1–P4两次均独立者的均值86.25/78.75、B−A=−7.5秒正确，因此断言2通过。另报全五人93/81且明确混有协助，允许保留。
- 独立配对按顺序应为AB −25秒、BA +10秒。答复AB换成含P5协助的−26.7，BA报+12.5，与自己表中92.5−82.5也矛盾。第二条calculate的`((100-85)+(85-75))/2`误把P3的A=90换成85；这是输入绑定错误，工具对表达式计算正确。回执另有95/76的首次/再次均值输入错误，实际为97/77；最终正文未复述95/76，不扩大为正文错误。
- 顺序/练习是有依据的替代解释，但“与版本无关”“被顺序效应充分解释”越过了非随机小样本的因果边界。原话缩写基本忠实，不能据此捏造虚假采访指控。
- 将P5称为新用户，并称入口风险在新用户“最高发”，原材料既无身份也无发生率证据。建议招募新用户本身合理，不能用不存在的当前事实作理由。
- 后续4人×2任务、匹配但不同材料、顺序平衡、记录与中性问题有实质价值。不过“≥3/4无需提示、B更好→扩大灰度”与“任一新人提示→维持不放量并回炉”可同时成立，且未分A/B提示。缺乏互斥或优先规则，不能形成明确的改变建议判据。60秒、3/4等拟议阈值本身不是伪造已批准标准。

断言之外：题面明确不调用工具，而同run两次calculate均done。仅为纯数学、无外部写，也不等于遵守禁工具。此项单列，不改冻结五断言，也不把工具成功当成原表核对成功。正文“本轮全部缺失”还错误覆盖了本轮已有的独立/协助完成及总时长指标。

旧版全文3093字符；汉字1864 + alnum词块185 = **2049 heuristic**，去空白含标点/Markdown2811。无冻结长度阈值。provider总30594 tokens（28169输入、2425输出），24.894秒，不是评分耗时。

## 候选：任务层已拦截，不能评价未取得的专业正文

task `task-mtp2lix5-e7x7b`；session `wb-expert-task-mtp2lix5-e7x7b`；run `expert_task-mtp2lix5-e7x7b_mtp2ljct`。已按ID与`evidence/rqa15-holdout-new-live-2026-09-06.json`核对task/capture完全一致，prompt、brief.materials、answer及timing一致。

- 原始完整前置输入存在，同run user message包含观察表、逐字陈述和资源约束；不是委托只给了空材料。
- MODEL length→FINALIZE stop；kernel终态DONE，但任务实际为 **needs_input、deliverables=[]**，gateStatus=blocked、verificationPassed=false，记录`ungrounded_external_fact`。
- 最终36字符为“当前缺少可验证的来源证据，不能确认回复中的具体事实。需要先获取相应来源。”，由VERIFY_CLAIMS阶段提交。用户没有收到所需分析，不能称作review/验收成功。
- 被检查的完整专业答复不可用；本审查不判断具体误拦/漏拦根因、不把fallback当作原模型分析、不声称原模型正确，也不能由fallback推断用户未提供材料。source-check定位归主线/Peirce。

`with_skill/grading.json`以`status=not_evaluable`、五项`passed=null`与`pass_rate=null`保留冻结断言，明确是未评分扩展，**不要将null转换为false/0或计入通过率分母**。这与旧N01真实stop后仅“收到。”的可评分0分不同。候选0工具、provider 11888 tokens、41.889秒；36字符中33汉字，长度不是此处N/A的判据。

## 范围与限制

本case新增旧版及候选grading.json和本报告；输入SHA256保存在各grading，原始文件未改。N01旧grading也保持原hash。两题四run中三份可评分、一份N/A，留出只有1题、无可评分的新旧配对。可描述完整包2.0/2.1及运行结果差异，不作纯Skill因果、总体通过率或专家生产认证。平台verified不替代专业评分，平台阻断也不自动证明专家能力为0。官方viewer由主线更新。
