# RQA17：核验诊断与专业复评（2026-09-06）

状态：阶段性工程增量完成，24专家全集目标仍 ACTIVE，无专家据此获得生产资格。本轮不是Skill A/B，也没有把返回review等同于专业正确。

## 实际发现

隔离QA对原SA-H02和UR-H02任务进行真实重试，临时观察器透传原verifyClaims/run返回，不改变材料、权限、门禁或专业包。观察结束已恢复，最终QA重启确认无观察器。

| 实际run（任务后缀） | 真实结果 | 专业评价对象 |
| --- | --- | --- |
| expert_task-mtp2li38-xgh19_mtp4xml0 | SA-H02，5644字符候选被两个“结论”字段核验拦截；needs_input、零成果，实际回复36字符 | 候选2/5；用户实际fallback仍N/A，不算交付 |
| expert_task-mtp2lix5-e7x7b_mtp4zvq8 | UR-H02，1893字符完整候选即交付，review、1份answer待验收 | 实际答复2/5，专业不合格 |
| expert_task-mtp2li38-xgh19_mtp5ohjx | 诊断补丁后SA重试，3713字符候选仍被两个“结论”字段拦截；needs_input、零成果 | 本次候选未另行专业评分，仅验证诊断链 |

前两次均MODEL length→FINALIZE stop，零工具调用。SA耗时60.524秒、19995 tokens；UR耗时36.945秒、14395 tokens。原材料确实已进入SA当前run，不能把此次拒绝解释成用户没有提供材料。此前RQA16完成声明失败是另一次run，不能用本次候选倒推此前未捕获的正文。

SA候选算对积压960000条及净排空80分钟，但混淆排空时间与FIFO等待时间，错误断言所有突发及之后80分钟到达事件均超时；幂等副作用原子性、早ACK迁移及故障注入闭环也不完整。UR算对独立配对均值，但把第二次任务更快解读反了，未正确控制顺序效应，后续验证缺少完整成功指标。细节及冻结断言见逐例grading/review；5项标准通过2项不是主观“五星评分”。

SA评分由方法作者在已曝光提示下完成、非盲，主线非作者通读复核；UR评分者非方法作者但已看用例、非盲。不能据两例推断全集能力或宣称升级有效。

## 通用生产改动

仅5个生产文件：新增agent-verification-diagnostics.ts，并接入agent-grounding-labels.ts、agent-grounding-ledger.ts、agent-run-executor/phases-ground-persist.ts、workbench-task-store.ts。

- 最后一次核验后、拒绝文本替换前生成候选指纹、字符数、材料快照指纹、run/task及有限字段检查。持久化不额外保存被拒绝正文或字段原值。
- 版本、run绑定、primitive-string hash、安全整数及字段数量严格归一化；非法诊断丢弃，旧任务仍兼容。SHA256只是指纹，不是加密或可信来源证明。
- 用户提示优先指向实际安全字段标签，例如“结论”；操作完成声明不再一概描述为缺少读取。原历史回复未重写。
- 诊断scope显式限定为执行回执与有限字段检查，不代表语义真实性；不参与授权、验收或成功状态判定。没有专家ID分支，没有放宽verifyClaims、requiredTools或证据门禁。

改符号前GitNexus impact：runGroundAndPersist LOW（直接run）；formatViolationForUser LOW（索引直接formatter，并人工核对渲染调用）；buildHonestRefusal LOW；normalizeExecutionEvidence LOW（直接normalizeTask，间接创建/更新/事件/验收）。新helper在索引中未找到，风险UNKNOWN而非零。FTS不可用，process资源读取未找到，已用当前源与直接调用补足，不声称图谱完备。

整棵共享脏树detect_changes为309文件、584符号、160 affected、CRITICAL，包含此前及并行改动，不等于这五文件的局部风险或整树已审完。独立review在内存中反向去除此局部补丁，四个原文件指纹恢复到本阶段之前；未回滚磁盘或提交。

## 测试与真实重开

- 独立诊断26项：4通过/22失败→26全绿，断言不改。
- 独立类型反证17项：5通过/12失败→17全绿。发现并修正RegExp隐式接受数组/可转换对象及null-prototype抛错问题。
- 两套独立43项全绿；主线合并原回归共112项全绿。
- 最终npm run check（session99297）exit0：backend2667总/2616通过/51既有跳过/0失败；renderer80文件560项通过；lint和typecheck通过。lint有现存测试文件行数提示，非失败。git diff --check exit0。
- 初次未加register-ts preload的测试启动失败不是有效产品测试；修正命令后执行上述回归，未把启动失败隐藏为通过。

第三次真实run使用的是诊断首版（尚未加载最后严格hash类型守卫）；其普通字符串诊断与真实候选、材料核验输入一致。随后只重启自有QA，确认加载最终strictHashes版本且无观察器，再从工作台重开task-mtp2li38-xgh19。未再执行模型或点击接受成果。

重开读取：needs_input、deliverables=0；3713字符候选SHA256=b24879cd680cbfcf2a07b15d5f3a50e014d8a2caad70a472de63401a01fa63b8；材料快照=b7574dbf96601acec276d114c44044d113b22924937a090aee5e773780d29eae；1份材料、2个结论字段诊断保留。页面DOM有1个主textarea及1个重新执行按钮；截图确认主输入框可见，未声称滚动视口外重试按钮当时可见。新提示准确指向“结论”，旧失败回复保留，重复提示及重试布局尚非高质量对话验收。

QA仅使用9223及临时userData D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de，未改用户APPDATA或重启用户应用。

## 证据

- rqa17-initial-verifier-captures-2026-09-06.json：前两次原候选、核验、run和任务快照。
- rqa17-post-diagnostics-live-2026-09-06.json：第三次透传观察与持久化比对。
- rqa17-sa-h02-diagnostic-reopen.png：最终QA版本重开截图，主线已实际查看。
- rqa17-verification-diagnostics-review-2026-09-06.md：冻结红绿测试、类型反证、独立源审查。
- rqa17-claim-boundary-analysis-2026-09-06.md：未修语义边界及混合无效引用反例。
- ../skill-evals/professional-batch4-workspace/verifier-diagnostic-review.html：官方查看器，两run分别标明候选/实际交付范围，不生成总体benchmark。
- ../skill-evals/professional-batch4-workspace/rqa17-viewer-generation-2026-09-06.md：两run内嵌原文/评分校验、原文件hash不变及jsdom检查；不是跨浏览器视觉验收。

## 继续条件

尚未修复分析结论被当外部字段逐字核验、条件/引用里的完成语句误归为自身执行，以及有效+无效混合引用漏检。后续需通用声明/来源/回执边界和混合反例，不能靠“结论”标题或专家ID全篇豁免；真实操作仍须宿主回执，必需工具/成果证据保持独立硬门禁。

专家方法的数学、因果、故障恢复硬伤必须通过未见场景和独立复评改进；24专家全部正常/异常闭环、安装一致性、完整生图及视觉验收仍未完成。无需用户重新授权才可继续这些在范围内的工作；本轮交接不是blocked或complete。
