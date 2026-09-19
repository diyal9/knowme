# 修复核对

原始审查：`docs/reviews/2026-09-16-ui-display-review.md`。

七项发现逐一落实：共享路由名称、完整路由列表、装配字段保留、跨类型依赖解析、声明权限值、授权状态共用投影、交付摘要与文件成果分离、状态和风险中文化。

验证没有改变 ID、工具授权、路由选择或文件成果验收要求。新建/导入通过真实 API 测试，渲染路径通过组件测试。未进行第二次 Bugbot 审查或真人验收。

## 追加：计划确认重复显示

任务数据核对：用户截图所指任务只有 1 次 plan_confirmed 和 1 次 task_started。重复来自前端 plan-confirm-* 即时消息与后台 plan_confirmed 事件都被渲染成用户发言；历史恢复路径 restored-plan-confirmation-* 也存在同类问题。

在 buildExpertCollabNarrative 按平台生成的消息来源及确认内容进行一对一合并，保留事件原始数据；不按文本全局去重，不改变任务启动流程。影响分析工具仍缺完整调用边，源码确认直接调用方为 ExpertTaskRoom。

新增 5 个测试：即时确认、历史恢复、仅事件历史、普通重复发言、一对一匹配。修复前 3 项失败，修复后全部通过；结合专家任务页共 84 项通过。


## 执行未发生：2026-09-16 后续核查
- 实际任务 task-mu2yaq66-udvbo 的运行 metrics：toolCalls=0，available=0，loaded=0，artifactRefs=[]。MODEL 与 FINALIZE 均 finishReason=length；这不是开发工具运行失败，而是两次文本生成截断。
- 运行权限 tools.allowlist=[]，write=false。确认计划承诺完整前端代码包，但实际交付契约为 answer；生成步骤中的“技术选型”将网页任务选到 architecture-decision。
- 修复：公共创建/重试预检拦截明确的代码文件计划与工具/成果契约缺口；此检查不扩权，也不代表工具实际可用，后续仍须通过工具预检。普通评审建议不触发。多成果计划可由独立文件交付契约承接，不误拦文字摘要。
- 修复：路由不再从生成步骤匹配，用户目标及 host 保存的用户补充仍参与；启动提示不再暗示真实开发操作已经发生。
- 新增回归先复现失败，再通过。npm run check 通过：Node 3545 pass / 51 skipped，renderer 656 pass，lint/typecheck 通过。随后收窄建议类匹配并补充多成果测试，定向测试及 lint 再通过。
- GitNexus impact 为 UNKNOWN（索引缺失调用边），已源码核对创建/执行/重试调用。detect_changes 返回全工作区 362 文件/843 符号 critical，包含大量既有修改，不能作为此次修改范围；未提交，未修改用户任务数据。
- 限制：启发式识别明确代码文件交付，不覆盖所有自然语言承诺。当前软件工程师依然没有真实文件开发、运行测试能力；本修复不声称能完成网页开发。真实桌面重启后验收尚未执行。


## 失败后输入框消失
根因：ExpertTaskRoom 使用 !lifecycle.terminal 隐藏所有终态输入；failed 被误当作对话结束。修复为 failed 保留唯一输入框，发送沿用 expert-discussion，显式重试仍独立。新增真实页面发送测试，断言不调用 retry/createStart，修正原先期待失败态无输入框的测试。已完成和取消状态保持原有行为。GitNexus impact UNKNOWN，源码核对 ExpertTaskRoom 页面入口及 sendWorkbenchMessage 讨论通道；detect_changes critical 涵盖既有大范围工作区变更，未提交。


## 2026-09-16：计划尚有澄清问题时错误放行
- 根因：extractExpertPlanningState 在完整计划分支提前 ready；界面历史计划正则以及文字确认绕过澄清状态。
- 变更：先识别当前回复的缺项/追问，仅从最新有效助手回复取计划；纯确认问句不作为缺项。页面兼容入口也必须不处于 clarifying；confirmPlan 再次检查，文字确认复用同一 gate。
- 回归：同一计划末尾仍有三项追问、无问号补充要求、旧计划后续追问、纯确认、补充后新计划；组件验证没有两个执行按钮且输入确认不调用创建 API。
- 新测试先失败 6 项；修复后定向 102 项通过；npm run check 全量成功，日志 %TEMP%/knowme-plan-clarify-check.log。
- GitNexus impact UNKNOWN（无完整调用边），源码确认直接消费者为 ExpertTaskRoom。detect_changes 的 critical 为整份既有脏工作区，未提交，未将其视为此次范围。保留其他修改。
- 限制：自然语言恢复仍属启发式识别；本次未变更为结构化模型规划协议，未声称全面理解所有问句。未自动重启或重跑用户任务。

## 协作总结与用户确认
检查创建、执行成功、成果选择、验收、旧任务恢复和 UI 输入路径。执行 readiness 不再依赖用户先接受每个成果；部分接受不会重新生成已有成果。执行收尾使用最新 brief 保留执行中的用户补充；无 completionPolicy 的历史任务保持原有重试兼容。GitNexus 修改前影响分析 UNKNOWN，以调用源代码和回归补充；结束扫描为整个脏工作区 370 文件、853 符号、181 流程，critical，不能归因为本次补丁或当作独立范围证明。未提交。
