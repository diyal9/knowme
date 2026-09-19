# RQA16：修复预算接线与架构专家真实重试

2026-09-06。通用预算接线已修复，真实两次重试均从MODEL length进入FINALIZE stop；一条形成完整正文，另一条仍被完成声明门禁拦截。**未达到专家生产资格；全部24专家目标仍ACTIVE。** 原RQA15失败与N/A不回写。

## 最小生产修改及影响

只改src/lib/agent-run-kernel-adapter.ts的buildProductionRunPorts内LLM complete预算映射：优先本次reqPolicy.outputTokens；缺省时finalize保持2400、正常请求取base额度；最终不得超过req/base两个模型上限的较小者。修复策略、次数及是否允许工具仍由executor决定，没有专家ID特例，没有提高模型上限或重放副作用。

编辑前GitNexus impact：HIGH，6符号、3直接调用、3流程。主线已告知风险并读取executeAgentGenerate、createChildRunPortFactory、主runtime的工作流子任务factory调用上下文；签名和policy传递无变化，调用方无需接口修改。嵌套complete不在索引，UNKNOWN，不把0当无影响。独立评审将当前adapter在内存还原本次局部预算补丁，整文件hash精确回到实际红测文件，证明没有夹带其它adapter改动。

## 工程验证

- 独立新测试tests/rqa16-production-repair-budget.test.js：旧源最终29项15过/14失败；保持同一测试hash后29/29绿。早先23项12过/11失败也保留。
- 23项穿过真实executor、production adapter、stream parser，在注入的离线requestAgentCompletion处检查**最终请求体**；6项直调adapter边界。不用自制policy映射替代生产代码。两参数、800/2600/3200额度、模型cap、其它收敛2400、无工具字段、成功操作不重放、二次截断/取消不提交均覆盖。
- 主线连同RQA14预算测试38/38绿；独立源码复审29/29绿，未改冻结断言追绿。
- 首次完整check session6842 exit1：2623项中2571过、1失败、51跳过；唯一失败是knowledge-steward-store临时文件rename EPERM。未改该模块。单项原样复跑1/1绿；随后完整check session97282 exit0，test/lint/renderer80文件560项/typecheck通过。保留失败记录，不把它改成首次全绿；最终后端具体计数未单独截取，不推填。
- git diff --check通过。全共享脏树影响扫描309文件、578符号、160受影响、critical；含此前及并行改动，不是本次预算局部的独立规模，不声称整树已审完。

具体测试、红/绿指纹和局部源码复审见rqa16-budget-wire-review-2026-09-06.md。

## 两次真实原任务重试

只重启此前隔离QA（CDP9223，KnowMe独立临时userData）；未重启用户实例、未改用户APPDATA或模型设置。使用专家任务正式retry API，沿用2.1.0快照、原材料、原计划；原失败事件留在同任务历史。临时pass-through observer观察真实run和请求policy，原样返回结果，所有run结束后已恢复删除。没有mock模型或追加专家工具。

| case / task | 新run | 实际策略 | 模型终止 | 最终任务与交付 |
|---|---|---|---|---|
| SA-N01 / task-mtp2j3g0-uo0z8 | expert_task-mtp2j3g0-uo0z8_mtp40w2z | 2600→5200，cap131072，max_tokens | length→stop | review；4987字正文、1成果；0工具 |
| SA-H02 / task-mtp2li38-xgh19 | expert_task-mtp2li38-xgh19_mtp40w7c | 2600→5200，同cap/参数 | length→stop | needs_input；48字平台提示、0成果；0工具 |

N01总59.949秒、provider16511 tokens；H02总63.538秒、16819 tokens。数字为whole-run记录而非finalize单轮。**真实观察器捕获的是进入production adapter的policy，不是HTTP body**；最终body映射由上述真实adapter离线测试证明。不能把这两种证据混写成实跑抓包。

H02最终提示为“回复中的部分完成声明缺少对应的成功操作凭据，尚不能确认这些操作已完成。已有需求和执行记录已保留。”任务attention为evidence_incomplete/retry，detail“当前还没有成功的读取结果，不能声称已完成读取”。不能由这段平台替换文推断模型确实声称读过资料，更不能评分其不可得专业原文；继续记N/A。长度问题改善不代表完成声明核验问题已解决。

N01完整原文可评，但主线通读已见重大专业问题：把T=4撤销、T=4.5仍获访问误判为违反“撤销后至多5分钟”从而否定合法TTL界限；没有闭合许可有效时启动、过期后输出的检查；迁移回滚旧校验会重新引入已否决策略；无依据承诺两人四周足够。有完整正文不代表是正确架构建议。逐冻结断言由SA方法作者非盲复核，主线作为非作者核对；评分另存runtime-repair-iteration/SA-N01，不覆盖RQA15的N/A。

评分已完成：**1/5，只有冲突与批准边界项通过，专业不合格**。主线通读冻结五断言、完整答复和作者曝光报告，确认TTL算术、缺结果复检及回退安全前提不足；不因选择60秒或物理分区这一合法建议本身扣分。对旧实现不能推定存在A3草稿中的所有漏洞，准确问题是答复未约束回退路径保持相同安全门禁。报告见../skill-evals/professional-batch4-workspace/runtime-repair-iteration/SA-N01/sa-review.md。

## 重开体验及版本边界

实际reload后从工作台打开SA-N01，No=mtp2j3g0-uo0z8核对正确；完整架构正文渲染、一个主输入框、接受成果按钮均存在。未点击验收。截图rqa16-sa-n01-reopen-content.png已主线查看：头像/输入框左沿一致，长表格仍较密，侧栏交付文案过长；不是全部视觉验收。rqa16-sa-n01-reopen.png是在首次读取DOM尚有“正在整理内容”时保存，不能单凭该次DOM读数称正文消失；随后等实际heading出现再核对。

随后从同一刷新后列表打开SA-H02，核对No=mtp2li38-xgh19，实际只有1个主输入框、1个重新执行按钮、零成果；rqa16-sa-h02-blocked-reopen.png已主线查看。没有把kernel DONE显示成验收成果，但提示仍重复且错误地要求读取凭据，不能称异常体验已完善。本次只核对恢复状态，未再点击重试制造循环。

本轮生产adapter SHA256=365C148C17FED946C3CED093257D12A41F975065B57D67C43CC791BFB679709A；ground-persist保持F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C。model-tool当前为0BBA6FE97FFB082E0D792C31AFBE5B88D00372E6FEC567D584B2C9D8CC35E2BC，已不同于RQA15记录；本主线未修改该文件，独立红测时已是此值，红绿间相同。共享工作区其它变化保留，不把跨批实跑视为严格只有一个变量变化；也未恢复旧文件以凑对照。

原始快照、capture.result、真实policy、起始retry回执在rqa16-sa-retry-live-2026-09-06.json；逐case完整transcript和answer在../skill-evals/professional-batch4-workspace/runtime-repair-iteration/。

## 继续项

先补可定位的通用声明核验诊断，区分来源归属事实、分析推断、拟议步骤和已完成操作；不以关键词白名单或专家特例跳过安全门禁。专业能力仍需反例执行检查、证据/数值绑定、决策条件自检，并用新题验证稳定收益。方法建议见rqa15-professional-next-iteration-notes-2026-09-06.md；这些是待验证假设，不是新增规则必有效的保证。其余专家、知识/飞书、完整生图及正常/异常全生命周期资格继续进行。
