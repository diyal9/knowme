# 第二组真实专业资格测试（进行中）

日期：2026-09-06。这是24专家总目标中的增量，不能当作全集验收。测试使用独立 Electron userData 和真实 qwen3.8-flash，无模型输出夹具；资料均为虚构输入，未操作用户原任务、原安装包或真实外部对象。源码包只同步到隔离QA。

## 现有包基线

| 用例 | 任务 | 实际结果 | 资格判断 |
|---|---|---|---|
| MS01 决议/责任/原文锚点 | task-mtoqv2bt-dglkt | 模型前错误要求未声明的 feishu.related_chats，没有答复 | 平台阻塞，不能评为专业内容通过 |
| FC01 发布范围/转载链/满意率 | task-mtoqv2gm-djhce | 正文有正确发现；修正文将历史材料扩成“当前”，统称媒体转载 | 专业不合格 |
| FC02 生效版本/币种/优惠条件 | task-mtorajpa-dm81w | 正确保留新版截止、100美元非现金及门槛 | 待独立逐条评分；单例不能认证专家 |
| FC03 引语/无法读取的证据 | task-mtorajue-iyjhj | 修正文新增“效率提升数据尚在整理”“另行公布” | 专业不合格 |
| DR01 管理摘要/指标口径 | task-mtoqv2kz-nrr87 | 遗漏相对增长20%，凭空增加未提供的N/P来源 | 专业不合格 |

均为专家2.0.0。基线使用一个用户指定的 primary answer；原包多个默认交付ID没有匹配到它，且MS/DR包的默认执行交付本身就没有requiredSkills，不能将装配缺口仅归因于ID不匹配。没有收齐MS/DR同run的独立L1内容hash/截断回执，因此这是当时真实单答复入口表现，不是“全部专业方法正文均加载”的测试。未读取来源N/P的证据不能证明记忆污染根因，只确认该说法无输入依据。进一步逐字段评估见professional-ms01-dr01-review-2026-09-06.md。

## 事实核查方法候选

事实核查原来依赖 knowledge-steward（知识库入库维护），与只读核查不匹配。2.1.0改为 evidence-verification 1.0.0：拆分陈述、证据范围、版本时点、转载链、精确引语、缺证据与反证区别、修正文复核、修改依赖。默认合并为一份answer并声明requiredSkills；network/write/externalWrite仍false，未开放工具权限。

三例同输入真实候选：FC01C task-mtormlqz-57xyt、FC02C task-mtormm2u-5pyut、FC03C task-mtormme5-n19ca，均review。实际日志三次均显示skillRefs=evidence-verification，skill.explicit-content 1217字、hash c626e343b2a65fbd、truncated=false；不能再把错误归因于方法没加载。

候选仍不能通过专业资格：FC01修正文依旧笼统将媒体归为转载；FC03凭空写出“使用效果尚在评估中”。分类部分还需区分身份未知与引语不符，不能把“未标CEO”直接证明“不是CEO”。不能只检查主表，正文、修正文和额外说明都在验收范围。

旧输出复用历史运行，候选在新包上运行，并非同时随机对照；每题每配置单次，不能把差异全归因于Skill文案或宣称稳定提升。原文/回执/方法差异在 skill-evals/professional-batch2-workspace/iteration-2；查看器使用skill-creator自带脚本生成，独立评分随后补入。

字数不以Markdown原始字符数直接判断：FC01候选raw786/CJK471/中文字符加字母数字词块514；FC02 raw337/CJK201/词块237；FC03 raw417/CJK266/词块286。指标为启发式，不冒充编辑器正式字数。DR01基线词块649超过总600，摘要词块162没有证明超过180；不能把原始格式符也算作中文超限。

## 通用运行时修复及真实恢复

- RQA04按真实提供方联合校验必需工具，不要求每个连接器提供全部工具，不放宽空allowlist。162项定向测试通过，详见rqa04-fix-2026-09-06.md。
- RQA10调用前以正式执行契约为准，材料/SOP/否定句不再推导飞书工具义务。116项定向测试通过，详见rqa10-contract-intent-2026-09-06.md。这些是定向测试，不替代整仓check或真实任务。
- 重启隔离QA后，实际点击MS01“重新执行”：新run expert_task-mtoqv2bt-dglkt_mtos0ilf 生成纪要并进入review，无工具调用。主输入框1、接受1、重试0；截图ms01-contract-retry.png已查看。原失败历史保留。
- 该纪要正确区分周五提议与延期决议、保留回滚负责人待定，但额外将陈琳指派为组织复核会负责人，并写出未决议的继续顺延规则。工程恢复成功，专业仍不通过。用户未明确的负责人不能由主持身份推定。
- RQA10只读追加审查发现：execute后处理仍可因标题“整理会议纪要”重扫材料，用缺工具拒绝替换正常结果，且可能通过通用OutputGate。后续已修复：正式执行不再走文本推导的飞书hint，legacy补齐显式契约证据门禁；普通聊天候选只在真实待选且尚未读取正文时覆盖。165项定向测试通过，详见该报告追加节；新增后处理尚未进行新的真实QA运行，不能把原MS01成功扩展为所有入口通过。

## 单输入框修改与重开

在FC01C的主输入框输入新增E第2段证据与350字约束，点击发送而非额外修改表单。run expert_task-mtormlqz-57xyt_mtos4clg 生成v2，comments和原v1均保留，E独立采访被采用。正文中用户意见带“请按以下意见修改：”前缀，因此无前缀exact locator为0并不代表丢消息；实际body完整包含意见。重新返回列表再打开：意见存在、v2存在、主输入框1、接受按钮1。截图fc01c-review.png和fc01c-revision.png均已查看。

v2仍有专业问题：将8月1日公告中的内测状态改为8月1日“进入内测”，无据推定开始日；长度与分类还需独立评分。不因为正确采纳一项修改就判整稿合格。实测记录见professional-batch2-live.json，未覆盖真实用户数据。

## 工程门禁与剩余项

事实包定向测试 expert-required-skills + expert-catalog-contracts 10/10通过。RQA05已完成图片字节实际解码、下载边界及ASAR原生依赖定向验证，41/41通过（含Electron五格式解码）；SVG/APNG拒绝，metadata/header尚无硬超时，不等于完整发行包或真实生图端到端验收。

首轮整仓check session40634失败：后端2205通过/1失败/51跳过，未进入后续门禁。矩阵定位出真实导入工具定义使用user-data范围，但registry/governance两处枚举不承认，导致import_external_project及verify_imported_workflow注册失败。新增真实工具定义回归先2红，再仅在两处补齐范围枚举，22项registry测试通过。空allowlist、denylist、expertToolNames空集仍拒绝；import的trust_confirmed=false仍拒绝。这里验证保留既有参数/ACL限制，不代表新增了独立的人类确认凭据验证。

矩阵随后暴露旧连接器替身仅返回ready却没有工具发现结果；补充固定Pango提供方的raw/projected/selected发现数据，不从专家requiredTools反推可用工具，不放宽预检。所有内置专家声明交付顺序/验收及配置失败两项矩阵通过；这是替身工程测试，不能当真实生图或专业认证。

修复后完整npm run check session41442 exit0：后端测试、lint、renderer80文件559项、typecheck全部通过。控制台完整输出被截断，未另存全量日志，因此不补造本轮后端精确计数。当前门禁覆盖RQA04/05/10及user-data范围修复；后续源码修改须另验。

事实对照材料导出曾按会话数组位置错误绑定，独立评分发现candidate FC01/FC03、baseline FC02/FC03错位。已按原始taskID重绑定，保存旧绑定快照与SHA核对审计，不改冻结输入、模型答复或原始回执。这是主线测试组织错误，不是模型回答错误。审计见iteration-2/binding-repair-audit-2026-09-06.json；fact-review.html已使用UTF-8模式重新生成，六份独立grading已纳入。FC01旧/新3/5、FC02旧/新3/5、FC03旧2/5新3/5；不能用分数增加掩盖候选仍有事实硬伤，也不能归因为稳定方法提升。详见iteration-2/professional-grading-review-2026-09-06.md。

未完成：所有24位真实专业资格、重复/留出题、其余运行时失败恢复、安装升级保真、媒体端到端与全视口视觉验收。候选包暂不自动升级用户安装版本。
