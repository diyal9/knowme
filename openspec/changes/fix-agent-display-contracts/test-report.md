# 验证结果

2026-09-16，`npm run check` 退出码 0：

- 主进程/Node：3542 通过，51 跳过，0 失败（共 3593）。
- lint：通过；存在仓库既有文件长度 advisory，未产生硬错误。
- 渲染层：88 个文件、651 项测试通过。
- 渲染层类型检查：通过。
- 本次相关文件 git diff --check：通过。

新增回归：`tests/expert-display-contract.test.js`（5 项）、`src/domain/capability-display.spec.ts`（9 项）、`src/renderer/features/expert/expert-display-regression.spec.tsx`（4 项）。

未运行真实飞书授权、发行构建或桌面逐页视觉验收；没有修改生产用户数据。

计划确认去重修复后再次执行 npm run check，退出码 0；渲染层更新为 88 个文件、656 项通过，主进程测试、lint 和类型检查通过。


## 执行未发生：2026-09-16 后续核查
- 实际任务 task-mu2yaq66-udvbo 的运行 metrics：toolCalls=0，available=0，loaded=0，artifactRefs=[]。MODEL 与 FINALIZE 均 finishReason=length；这不是开发工具运行失败，而是两次文本生成截断。
- 运行权限 tools.allowlist=[]，write=false。确认计划承诺完整前端代码包，但实际交付契约为 answer；生成步骤中的“技术选型”将网页任务选到 architecture-decision。
- 修复：公共创建/重试预检拦截明确的代码文件计划与工具/成果契约缺口；此检查不扩权，也不代表工具实际可用，后续仍须通过工具预检。普通评审建议不触发。多成果计划可由独立文件交付契约承接，不误拦文字摘要。
- 修复：路由不再从生成步骤匹配，用户目标及 host 保存的用户补充仍参与；启动提示不再暗示真实开发操作已经发生。
- 新增回归先复现失败，再通过。npm run check 通过：Node 3545 pass / 51 skipped，renderer 656 pass，lint/typecheck 通过。随后收窄建议类匹配并补充多成果测试，定向测试及 lint 再通过。
- GitNexus impact 为 UNKNOWN（索引缺失调用边），已源码核对创建/执行/重试调用。detect_changes 返回全工作区 362 文件/843 符号 critical，包含大量既有修改，不能作为此次修改范围；未提交，未修改用户任务数据。
- 限制：启发式识别明确代码文件交付，不覆盖所有自然语言承诺。当前软件工程师依然没有真实文件开发、运行测试能力；本修复不声称能完成网页开发。真实桌面重启后验收尚未执行。


## 失败后对话框回归验证
新增测试先复现缺陷（4 个相关用例失败），修复后任务页及发送通道 77 项通过。check:quick 通过（lint，88 文件/657 renderer 测试），typecheck:renderer 通过。两次 npm run check 在 Node 阶段分别出现 connector-http-boundary、agent-web-tools 网络夹具断言失败，两者独立重跑均通过；不宣称全量门禁稳定通过。截图任务的失败为专业复核在自动修订后仍不通过，工具调用 0、成果 0。未重跑用户的真实任务，未完成真实桌面视觉验收。


## 2026-09-16：计划尚有澄清问题时错误放行
- 根因：extractExpertPlanningState 在完整计划分支提前 ready；界面历史计划正则以及文字确认绕过澄清状态。
- 变更：先识别当前回复的缺项/追问，仅从最新有效助手回复取计划；纯确认问句不作为缺项。页面兼容入口也必须不处于 clarifying；confirmPlan 再次检查，文字确认复用同一 gate。
- 回归：同一计划末尾仍有三项追问、无问号补充要求、旧计划后续追问、纯确认、补充后新计划；组件验证没有两个执行按钮且输入确认不调用创建 API。
- 新测试先失败 6 项；修复后定向 102 项通过；npm run check 全量成功，日志 %TEMP%/knowme-plan-clarify-check.log。
- GitNexus impact UNKNOWN（无完整调用边），源码确认直接消费者为 ExpertTaskRoom。detect_changes 的 critical 为整份既有脏工作区，未提交，未将其视为此次范围。保留其他修改。
- 限制：自然语言恢复仍属启发式识别；本次未变更为结构化模型规划协议，未声称全面理解所有问句。未自动重启或重跑用户任务。


## 删除按钮位置调整
按钮由专家资料卡移至本次委托标题行右侧，标题行占满与上卡同宽的侧栏；移除资料卡按钮空列，保持删除回调与确认流程。既有删除流程测试的归属断言同步更新。Node 3550 pass / 51 skipped；界面和类型检查见本轮日志 knowme-delete-placement-ui.log。未执行真实桌面截图验收。


## 专家对话右侧多余边框
根因：ExpertCollabDialogue 的 TaskDialogueShell 内嵌 agent-col 继承通用分栏 border-right；既有外层去边框规则不覆盖此内层。修复已有 draft-room/followup-thread 规则，设置 border-inline:0，正常滚动条不变。未修改函数。Node 3556 pass/51 skipped；lint 通过，renderer 686 pass/1 fail（未修改 artifact-preview.css 的字体大小不符合 surface-css-contract），typecheck:renderer 通过。未执行真实桌面截图验收。


## 工具 JSON 格式纠正（2026-09-17）
parseToolArguments 保留 invalid_args 兼容分类，增加安全诊断：固定错误分类、字符长度、可提取的字符偏移、SHA-256 短指纹。不持久化原始正文或可能包含正文的解析器错误信息。诊断进入原有工具错误 text/步骤摘要；JSON 语法失败有专用纠正提示及最终说明，不再要求用户补 token/关键词。不放宽 JSON 校验、不猜补正文、不增加重试预算。
定向 48 项通过，包含无效 JSON 不 dispatch、修正后内容保持、流式跨分片转义保持、错误诊断无正文泄露。npm run check 后端 3560 pass / 51 skipped，lint 通过，renderer 686 pass / 1 fail（既有 artifact-preview.css 字号规则）。typecheck:renderer 单独通过。未真实重跑用户任务，不声称历史原因已经确定或模型纠正必成功。
GitNexus 三个修改函数 impact UNKNOWN；源码核对工具校验、恢复及失败提示调用。detect_changes 为整个既有工作区 critical，不能隔离本轮修改；未提交。

## 协作总结与确认结束（2026-09-17）
- 后端定向回归 72 项通过：默认等待、多成果一次产出、逐项接受、修订新版、重读持久化、旧自动完成恢复不重跑、执行中补充与历史重试兼容。
- 专家房间 UI 回归 77 项通过：统一总结卡、保留输入框、显式确认、多成果确认且不调用生成、用户已确认任务保持结束。
- npm run check：Node 3562 通过 / 51 跳过，lint 通过；renderer 686 通过 / 1 失败，仍为已有 surface-css-contract 对 artifact-preview.css 的 10/11px 字号约束。全量门禁未全部通过。最后新增的 UI 用例已单独回归。
- 未在真实桌面重新调用模型生成；后台状态改动需要重启应用生效。
- 最终 renderer 类型检查通过。修正多成果调整测试对异步错误文案的等待，避免读取空 alert。
