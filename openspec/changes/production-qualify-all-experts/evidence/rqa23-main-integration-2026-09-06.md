# RQA23 — 专业方法对照与真实修改闭环
日期：2026-09-06。总体目标 ACTIVE；没有新增生产合格专家。本轮不是24专家全集完成，也不是单个生图验收。

## 结论
数据分析核心方法1.1.0已实现并通过隔离安装、完整L1装配及工程检查。两道新冻结场景各运行旧/新一次，四份真实交付；独立冻结评分旧13/14、新13/14，不证明整体收益。主输入框修改、v2交付和刷新重开真实成立；修订稿仍超字数。不得以加长Skill、review状态或工程绿测替代专业认证。

## 改动范围与方法
- src/catalog/skills/data-analysis-method/SKILL.md：1.0.0→1.1.0，补齐观察/反事实/行动分层、支持/矛盾/未识别区分、与观测相容的竞争机制、可逆决策与全文推断一致性。原单位/集合/缺失冲突/分母/计算/权限段落保留。
- 同目录capability.manifest.json及catalog.json该entry版本同步。无新增依赖、连接器、工具、网络或写权限；data-analyst仍2.1.0，未加专家ID运行时特判。
- tests/rqa23-analysis-method-contract.test.js：独立7项结构合同，主线使用项目TS注册器重复通过。直接node --test第一次缺TS加载器失败属于调用方式，不能冒充产品红绿修复。
- skill-creator用于保存旧快照、冻结新题、独立评分与官方查看器；为真实安装同一profile可比性，先完成旧两题再精确升级核心方法再跑新两题，未同时混用安装目录。不是技能文档建议的并发子代理试跑；专家能力以实际KnowMe路径为准。
- webapp-testing用于自有隔离Electron Playwright交互，沿用现存JS连接，不重启日常应用或创建Python服务器。
- GitNexus方法文件impact未找到可索引符号，风险UNKNOWN，不能当零影响；只读实际消费者/装配审查补充。整树detect_changes为320文件/699符号/172affected、CRITICAL，含大量既有并行改动，不表示本轮全写或全审。未提交、reset或覆盖其他改动。

## 冻结输入与实际装配
两题是字幕校对工时/排班，以及会员支持门槛/匿名时间偏好，不复用R20原表。用例作者知晓R20/R22失败，但在阅读新方法前冻结，版本标签可见，非盲。模型只收到user_input，不含评分锚点。输入哈希逐对一致。

| 配置 | 场景 | task | 评分 | mixed/预算 |
|---|---|---|---|---|
| old1.0.0 | N01 | task-mtpge9a6-jdxnm | 7/7 | 715 / 550–800 |
| old1.0.0 | H02 | task-mtpgeadj-xerjm | 6/7 | 886 / 600–850 |
| new1.1.0 | N01 | task-mtpgg65w-xx9wa | 7/7 | 800 / 550–800 |
| new1.1.0 | H02 | task-mtpgg795-3ix1x | 6/7 | 862 / 600–850 |

独立方法审查读取同run日志：4/4 skillRefs=[data-analysis-method]，完整skill.explicit-content，truncated=false，included16/omitted0。旧块1358 chars/hash0182b3392b9b2792，新1981/hash031ed971d9b5b4c2，与保存installed.text纯内存重建相符；没有把可选方法摘要当作L1全文。安装PID同为9072，先结束旧两轮再安装1.1.0。专家/SOP及同题材料manifest指纹不变，但task_fact有差异，未保存最后发送messages字节及temperature/max_tokens，不能称严格单因素因果。

四轮日志只有MODEL/stop、0工具、无FINALIZE。主线捕获的verifyClaims文本与同session assistant及primary正文一致。验证scope为execution_receipts_and_labelled_fields_not_semantic_truth，fieldCheckCount0，不是语义正确证明。本批没有触发数字修复分支，RQA22真实repair证明缺口仍在。

## 专业判断，不掩盖分项
两配置各accuracy6/6、critical2/2、decision2/2、presentation1/2、authorized2/2。H02失分是冻结条目要求的小表未列最终42%—82%范围；正文算对且完整出现，不能错误报告为数学/因果失败。两稿仍超850字，字数独立记录。

N01新稿≥20%属于未来建议，不是伪造用户政策或已证明安全；但缺少为何取该阈值的解释和认可。独立评分未将它判成冻结critical，主线保留该公平边界，同时用真实反馈要求撤回未经约定阈值。两份小样本核查达到最低“改善可比性+工时/质量”标准，不代表人员推广、学习次序、质量等效等设计已完整。两个新场景单次平分不能认证专家，也不能推断1.1.0解决RQA22原因果错误。

## 真实UI修改、版本与持久化
在new N01实际任务打开，点击退回修改只聚焦唯一主textarea；发送针对20%门槛的修改意见，文本真实出现在对话，任务进入执行并回到review。不需要第二个输入框或再次确认执行。
v2 previousVersionId链接v1，原文及用户意见保留。修订稿保留3.50/2.50、28.57%、7/5小时及1小时差，撤回固定节省阈值，并说明小样本限制和由工作室另议规则。但完整稿mixed909，超过800上限109；不因反馈被处理而忽略交付限制。v2不纳入四份首轮A/B评分。

reload先回伙伴主页，经工作台重开目标任务。首次紧接点击读取时仍在加载（0textarea、正文未出现），保留rqa23-revision-reopen.png；等待textarea可见后，正文/修改意见/v2均恢复、一个可用主输入框，另存rqa23-revision-reopen-settled.png并主线目视检查。不能用瞬时加载态误判数据丢失，也不能把等待后的成功说成无加载过程。未点击接受成果，没有真实排班/人员联系/外部操作。

## 工程验证
npm run check，session11920，exit0：
- backend3316项，3265通过、0失败、51既有跳过；
- renderer85文件、597通过；
- lint、renderer typecheck通过；3处文件行数软警告保留。
完整stdout未全部保存，但对应汇总已捕获；rqa23-check-and-ui.json记录门禁及UI观测。未为查看UI做renderer:build。
核心SKILL SHA256447bc23b8c56af9859c815e2d61b13a231d520ce50195c33cc701482bdc81a02；canonical ed8684b82794cdfb87822d44551a0a488352379cdf07d92d61943872689d97a2；测试3ad9bcecd69bb39dd2d1ac7683e05e0f9f0d2b422077290e9079993f3e55f1a1。旧snapshot额外终止空行单独固定，不冒充byte-identical；实际old installed.text匹配原c3a265…全文hash。

## 证据与下一步
原始：rqa23-old-runs.json、rqa23-new-runs.json、rqa23-revision-run.json；冻结：rqa23-professional-cases.json；独立：rqa23-professional-grading.json/.md、rqa23-professional-method-review.md。查看器使用skill-evals/rqa23-data-analysis-workspace/iteration-1下实际答复，without_skill仅为官方benchmark兼容标签，实际含旧Skill1.0.0，未知tokens/time留空而非0。

后续保持原验收范围：未处理的字数/格式、旧因果场景重复验证、真实repair分支、更多专家专业性/完整生命周期/生图媒体。独立审查另外发现business-metrics/cause及business-insight catalog版本漂移，未夹带进本次核心方法对照修复，应单独对齐并回归消费者。不为获取“合格”而事后修改冻结断言，不把本轮分数平局包装为能力升级成功。

