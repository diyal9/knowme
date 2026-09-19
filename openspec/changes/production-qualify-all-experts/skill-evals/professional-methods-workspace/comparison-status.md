# 专业方法整包对照：执行快照

2026-09-06。尚在独立评分及RQA12修复阶段，不是生产资格认证。

三专家旧包2.0.0与候选2.1.0，使用隔离QA、同一qwen3.8-flash、同一当前运行时和冻结输入；只标题加配置标签。未改用户APPDATA。候选部署前完整备份隔离QA原专家目录到qualification-methods-old-2.0.0，三专用Skill此前不存在。首次路径保护因8.3短路径与长路径不一致拒绝复制，确认解析为D:/UserCaches/Temp后统一绝对路径才部署；无删除。

|题目|旧包task|候选task|旧/新平台状态|
|---|---|---|---|
|AO01|task-mtowd8nz-1tamv|task-mtowzd8a-zcz6o|review/review|
|RR01|task-mtowd8tv-ja8ye|task-mtowzdmo-c9tm5|needs_input/needs_input|
|QA01|task-mtowd8zn-rcehl|task-mtowze06-flgkn|review/review|
|AO02|task-mtowf01r-x9e5e|task-mtox1mbq-a3ywx|review/review|
|RR02|task-mtowf07y-5yet0|task-mtox1mo8-ahzy0|needs_input/review|
|QA02|task-mtowf0eu-ia7vs|task-mtox1n0a-196qg|review/review|

每题每配置目前仅一次，先旧后新、并发分批，非随机重复实验；方法、SOP、依赖装配和合并交付契约一起变化，不能解释为纯Skill文案因果。AO02/RR02/QA02是开发者已见的新场景回归，不是盲留出。不同轮仍可能有上下文选择及采样差异。

候选6run实际日志：action-extraction两次866字/hash185a3c82bd1e32a1；requirement-review两次1024字/hash7df874bae6857343；qa-test-design两次1016字/hash7fd29382fb4eaf38；均skill.explicit-content/truncated=false，只有对应方法skillRefs。旧6run skillRefs=[]；原唯一泛化Skill绑定不是正文已加载的证明。candidate primary答复由单一合并默认交付继承所需方法，不为测试另加requiredSkills。

旧RR01/RR02因ungrounded_external_fact被gate替换，新RR01亦被阻断（最终拒绝文涉及完成声明，具体同run violation待采证），专业正文无法恢复则评分N/A，不将拒绝文本打0分或冒充专业交付。新RR02交付并不说明RQA12已经修复。RQA12新增9项纯函数回归目前5通过/4失败，src尚未改，因此check17946的全绿只属于发现这些红测之前的快照。

17项新方法包定向测试通过：E/C/L/catalog一致、权限未扩、单一自定义交付继承方法、完整L1装配。仅证明结构/装配。主线已全文读取5份候选正文，仍见姓名漂移、时间边界错误和版本并发预期问题；由非对应包作者交叉评分，不能据更多Skill认证专业。

旧版原始材料、run绑定、台账及正文均保存在iteration-1/*/old_skill；候选由独立评审保存在with_skill并生成grading.json。review.html使用skill-creator官方生成器，须在收齐候选评分后重新生成。当前未修改RQA12运行时，以免改变本轮对照条件；下一步先修复通用材料/声明边界，再重跑受影响平台样本，不用专家特化文案绕过。

## 独立评分收齐后的更新

上述为运行结束时快照。随后12套证据/评分已收齐；原始旧/新结果冻结，不随后续平台修复改写。静态review.html已用skill-creator官方生成器重新生成（Windows使用python -X utf8），文件打开请求返回queued，不宣称已显示在用户窗口。

|案例|旧包|候选包|额外硬伤与解释|
|---|---|---|---|
|AO01|5/5|5/5|候选尾部把周敏写成王敏，局部分数不能代替全文验收|
|AO02|3/5|5/5|候选本次未发现明确硬伤，单次不构成专家资格|
|RR01|N/A|N/A|被平台替换的原答复不可恢复，不把拒绝文打0分|
|RR02|N/A|3/5|候选缺性能测量条件、给既有要求新增无据生效前提|
|QA01|1/5|3/5|候选仍有24小时内新建任务的错误预期、竞态覆盖不足|
|QA02|4/5|3/5|候选允许同基线双写到revision=8，与给定不变量冲突|

详见qa-independent-comparison-2026-09-06.md和ao-rr-independent-comparison-2026-09-06.md。不能据此声称三专家升级均有效，也不计算包含N/A的虚假总提升率。

候选RR01同run原门禁记录明确为false_execution_claim、unsupported_execution_claim（删除）、ungrounded_external_fact，且toolCalls/evidence均为空。没有原候选全文，不能确定究竟哪句话触发，也不能推断真的执行过删除。

本轮已按通用数据链修复RQA12一部分：当前task/run材料快照、GROUND/FINALIZE保留、有限字段来源检查、不相关工具不得放行、正确来源ID与嵌套请求回显隔离。之后的真实retry是另一个运行时快照，必须单独采证，不回填本轮12次对照。
