# RQA15：专业方法实际装配与真实新旧复测

2026-09-06。全部24专家目标仍ACTIVE。本轮完成三个专业包的候选方法、隔离安装、12次真实调用、逐份专业审查及局部重开验证；**没有任何一位因此获得生产资格**。Skill遵循skill-creator的冻结案例、原文、逐断言评分与claim审查流程；版本已知且各一次，不是盲测或纯Skill因果试验。

## 修改范围与通用边界

software-engineer、solution-architect、user-researcher的E/C/L/catalog升为2.1.0，分别新增1.0.0方法software-change-verification、architecture-decision、research-evidence-analysis。原code-review/writing-polish保留为可选辅助；三个核心方法由现有默认执行route和两个原成果requiredSkills声明。没有按专家ID增加运行时分支，也没有强行装配所有依赖。

三个方法及专家均保持network/write/externalWrite=false、工具/连接器allowlist为空。原成果id/title/type/required保留；自定义成果身份及额外方法并集有测试。源码候选与实际已安装2.0.0不是同一基线：pre-method-source仅是改动前源码快照，真实旧版来自隔离环境安装包及任务snapshot，不能混用。

本轮RQA15生产运行时没有修改。phases-model-tool SHA256=6706778DFE5DDBC54D4693AAADE06E845B75950BEB98F1395ABA08B5348F62E7；phases-ground-persist=F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C。后续预算接线修复单列RQA16，不回写本轮基线。

## 真实调用及专业结果

同一已配置qwen3.8-flash、同一生产运行时、同题材料；先跑6次实际旧版，安装3方法与3候选专家，再跑6次新版。安装precheck/install均成功，仅隔离QA，未改用户APPDATA。N01旧题和H02新题输入均冻结，评分标准未送模型。H02设计者知道方法方向但未据候选正文构题；不是完全无曝光的独立基准。

| case | 旧版任务 / 任务结果 | 候选任务 / 任务结果 | 专业旧→新 |
|---|---|---|---|
| SE-N01 | task-mtp24yar-rbgbx / review | task-mtp2j2o3-836i0 / review | 2/5→3/5 |
| SA-N01 | task-mtp24yox-gr5k1 / failed | task-mtp2j3g0-uo0z8 / failed | N/A→N/A |
| UR-N01 | task-mtp24yzq-x736d / review | task-mtp2j4aq-g00u3 / review | 0/5→1/5 |
| SE-H02 | task-mtp2gfw1-60boy / failed | task-mtp2lh9n-n8ya7 / review | N/A→4/5 |
| SA-H02 | task-mtp2gg85-1vkiq / failed | task-mtp2li38-xgh19 / failed | N/A→N/A |
| UR-H02 | task-mtp2ggk1-uld13 / review | task-mtp2lix5-e7x7b / needs_input | 1/5→N/A |

N/A表示没有可评分的专业正文，不记0，不进入专业均值分母。旧UR-N01实际完整正文为“收到。”且平台review，是可评分的0/5，不是N/A。五个failed均MODEL length→FINALIZE length，没有提交半篇正文。UR-H02候选kernel DONE但任务needs_input、零deliverable，最终36字为平台VERIFY_CLAIMS替换文；此前将其说成误验收的口头判断已纠正。

### 专业硬伤，而非文风偏好

- SE-N01候选正确修正了事务代码，但反例在库存已不足时仍假定原函数继续扣减，违反给定控制流；并发测试又要求已读入的局部变量自动刷新。旧版也有错误库存oracle和不可达的故障注入。
- SE-H02候选纯函数实现经审查者11组probe通过；原答复测试缺重复区间、失败不变性两类要求，并无依据声称100k通常小于50ms。审查者补测不冒充专家执行，也不补原测试设计分。
- UR-N01候选将9条记录写成8条，混淆人数/片段；两人观察被升级为普遍性，未复现被过快解释为风险降低。核心引语基本忠实，不诬称伪造访谈。
- UR-H02旧版把B的5/5独立完成写成4/5，顺序分组绑定及算术错误，并把练习效应说成足以排除版本影响。两次calculate本身正确计算所给表达式，错误来自模型填入错误数字；且题面禁止工具，不能把调用成功当遵守SOP。
- SA四次都未交付，不能给专业分或把增加Skill当能力改善证明。

SE评分员为候选作者，明确作者曝光、非盲；主线非作者已通读原答及两份报告，复核错误时序/测试控制流与纯函数probe。UR由非作者通读冻结材料、原文、工具回执评分，版本非盲。只有两道旧题具备可评分的新旧配对，留出没有完整专业新旧对照，不能据此发表整体提升比例。

## 方法真的进入本次模型上下文

rqa15-context-audit按精确run绑定：旧6次skillRefs为空、无显式正文；候选6次各一块完整skill.explicit-content，无截断。

| 方法 | L1含标题字符数 | block hash |
|---|---:|---|
| software-change-verification | 1441 | d5e386d4b1a7749d |
| architecture-decision | 1414 | 5511787dd7f20557 |
| research-evidence-analysis | 1027 | 0d1e6a723fd176d3 |

日志将部分skillRefs脱敏为sof***on/res***is；完整ID结合任务声明、安装记录及对应block身份确认，不把脱敏值说成原始全名。加载完整不等于方法有效。

## 工程、界面及证据边界

- tests/rqa15-professional-method-contracts.test.js最终23/23通过。真实红历史为部分候选落地时15过/7失败（22项），不是旧版22红。
- 独立故障注入发现新Skill network=true仍过22项。新增权限/dependencies回归后，逐个方法相同变异均22过/1失败，正常23绿；已封闭这项确定漏检，未声称穷举权限全部边界。
- 最后完整npm run check session21620 exit0：test、lint、renderer80文件560项、typecheck通过。后端完整计数未保留，不捏造。更早34404绿为历史。
- git diff --check通过。全共享脏树GitNexus为308文件/571符号/160受影响、CRITICAL，不等于本轮16个catalog文件及新测试的独立风险，也不声称整树已审完。
- 实际QA刷新后重开SE-H02候选，正文、一个主输入框与验收入口保留；未点击接受成果。旧UR仅“收到。”可验收也已截图核实。只覆盖这两类，不代表图片预览或24专家全生命周期通过。
- rqa15-se-holdout-review.png文件实际是列表首个同名的旧版failed任务，不能当候选review证据；随后按任务No核对选择第二个，正确证据为rqa15-se-holdout-candidate-review.png及rqa15-se-holdout-candidate-reopen.png。保留误选截图、不覆盖原证据。
- 临时pass-through执行观察器只记录真实结果后原样返回；12次结束已恢复并删除，没有替身模型或伪造工具结果。

原始12次在rqa15-{old,new,holdout-old,holdout-new}-live-2026-09-06.json；安装与上下文在rqa15-context-audit-2026-09-06.json。逐case transcript、原文、timing、grading及专业报告在../skill-evals/professional-batch4-workspace/method-iteration-1/；查看器为method-review.html。单次MODEL/FINALIZE成本是run级真实metrics，不是评分耗时。

官方查看器已最终重建12个不同真实task/run；仅生成HTML做N/A中性展示适配，内嵌原始评分和输出不变，实际0/5仍保留。官方aggregate_benchmark仅聚合SE-N01/UR-N01两个可评配对，另存paired-only-benchmark.json/md，明确4次子集、各题每配置1次，N/A及未配对留出不进分母。修正其模板默认3次/模型占位；聚合副本统一从timing.json读取真实总tokens和时长，避免官方脚本已有grading时长时漏读tokens的路径。旧20%/新40%只描述这两题的断言满足率，**不是专家合格率或全12次提升**；delta按官方目录序为old−candidate。原评分没有改，方法因果与总体资格均不成立。open_in_codex返回queued，只表示已排队展示，未声称用户已打开。

## 下一步

只读诊断已证明生产adapter会忽略修复outputTokens并重新钳到2400；需要通用接线修复和实际请求体回归，而非给SA特例。来源字段检查也能复现把分析结论当外部事实的边界缺陷，但本次UR被拒原候选/字段未留存，不能断言实际误拦的具体句子。详见rqa15-runtime-followup-diagnosis-2026-09-06.md。

继续RQA16预算接线及来源诊断，再以真实重试/新题复验；专业方法改进优先证据账本、控制流/反例和判据自检，不根据已曝光题硬填答案。全部24专家正常/异常闭环、飞书/知识、完整生图和视觉验收仍未完成。
