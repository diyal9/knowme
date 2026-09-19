# RQA12 通用材料来源与有限声明校验：主线整合

2026-09-06。工程阶段通过，不是24专家资格验收；不是任意自然语言事实核查系统。

## 范围

- provided-materials.ts及expert runtime→prepare→execute→kernel数据链由独立开发实现，主线读取源码增量及报告后接入GROUND。快照来自本轮brief.materials，绑定task/run和hash，固定user_material/unknown；不收集SOP、旧assistant、旧artifact，不产生执行回执。
- phases-ground-persist.ts在首轮及FINALIZE均核验同一ctxBundle快照。requiredTools、requiredEvidence、completionConditions和artifact合同仍独立执行，不因用户文本或改写答复而满足。
- agent-claim-source-check.ts仅支持明确的标签字段、局部未知/建议、有限评审结论和源ID引用；任意改写、自由叙述、跨行表格仍不在语义验证保证内。metadata明确verificationScope。一个精确片段只支持引用，不证明现实事实已独立核验。
- agent-grounding-ledger.ts取消用户材料/无关成功工具对全文的通行证。每个被抽取字段单独找片段；错误负责人、额外时间和无关句子里的不确定性不能被整篇放行。R1/R10使用token边界，括号引用不回退全部材料。真实工具来源alias需returned/requested同key精确相等。
- 当前工具正文通过同toolCallId、同toolName、done且成功证据条目关联，不把240字符digest当全文。tool-source-content.ts递归剔除请求/query/args/meta回显，超过深度/节点准入界限不提供提取内容。
- 只有完整引号包裹的明确静态前置句免执行态匹配，额外的“我已发送”仍要真实回执；不是整段“未执行”就豁免其它操作声明。
- 无凭据拒绝文不再凭空声称“工具已返回结果”。原RR01具体触发原文不可恢复，本次不替历史补造解释。

## 红绿及独立复核

原9项提供材料反例5绿4红，补实现后转绿。独立23项覆盖计算结果、空检索、源ID、尾注、Markdown、建议、逗号成员、完整工具正文、资源alias及静态前置等；另补嵌套请求回显正反例。GROUND集成5项；dataflow8项；真实runtime生命周期3项覆盖queued、修改及修改失败retry。生命周期使用真实store/runtime、生成端替身，不冒充真实模型或UI端到端。

目录静态测试之前强制SOP自身至少220字，与“专家路由+required方法”拆分冲突。改为SOP非空、真正required方法在E/C中绑定且文件正文存在、合计内容仍满足原结构阈值；optional/unloaded方法不计入。该静态检查不再命名为专业资格证明。新旧专业分数保留硬伤，不因测试变绿而改分。

全量检查历史：12953诊断test有3红（候选SOP结构检查+开发中的2dataflow）；60076有2个新增独立来源反例红，修复后42253完整check绿；随后补嵌套请求正文边界，再运行最终check79067。

最终check79067 exit0：后端2510项，2459通过、51既有skip、0失败；renderer80文件560通过；lint和typecheck:renderer通过。命令仅过滤控制台显示，保留npm退出码，无改动测试返回值。git diff --check exit0，仅无关GPU文件CRLF提示。

## 风险与未完成项

修改前verifyClaims/extractClaims/buildHonestRefusal/runGroundAndPersist影响为LOW并核对直接调用。classifyToolResultQuality为HIGH：3直接调用（Feishu读取增强、merge台账、mock ports），涉及模型工具循环和GROUND；主线在修改前向用户告知，读取这些调用并回归。新符号索引不存在为UNKNOWN，不能当无影响。

整树detect_changes为CRITICAL：305files/569symbols/160affected，含既有及并行工作，不归因于本次。未commit、未重置或覆盖用户安装，实际本次范围以上述模块、测试及方法包列举为准，不宣称整树全审完成。

存储入口仍有既有32项/8000字符限制，新快照不能恢复历史裁剪，unknown不升级complete。合法prepare全上下文packing、全部24专家真实任务、发行包、图片完整体验及长期稳定性仍需验证。快照hash不等于签名或授权；基于标签的检查不能代替专业评测或通用语义判定。原候选被替换前的详细claim/round审计仍需单独改善，避免记录不必要的敏感全文。

三专家12次旧新实际运行先于本次RQA12修复，分数与原始证据冻结，详见professional-methods-workspace。之后真实重试需新增证据，不能回填旧结果。

## 全量检查后的真实重试：仍未恢复交付

仅重启隔离QA Electron（9223），未操作用户应用9222；重用原候选RR01 task-mtowzdmo-c9tm5的任务/2.1.0快照/材料/权限，无新增工具授权，调用现有retry入口一次。

新run：expert_task-mtowzdmo-c9tm5_mtoym346。结果仍needs_input，gateStatus=blocked、verificationPassed=false、toolCalls/evidence均为空；本轮violation仅ungrounded_external_fact（具体字段缺少对应来源片段）。真实生成并非fixture，但被替换前原文仍未保留，因此不能判断具体哪一字段不受支持，也不能直接认定模型捏造或核验误判。

完整当前task/session另存rqa12-postfix-rr01-live-2026-09-06.json，不覆盖12次旧新对照。不能声称RR01已修好、不能给平台拒绝文本评专业分、不能以79067绿或64项独立定向绿关闭真实交付问题。下一步需要run/round绑定的最小核验审计与具体字段诊断，再决定门禁边界，不继续靠猜测扩充关键词。

独立最终报告为rqa12-independent-final-review-2026-09-06.md，主线已全文读取。其明确指出结构提取深度/节点阈值不是JSON输入字节/解析CPU/宽数组遍历的完整硬上限，本报告的“准入界限”只指提取结果，不扩张为资源沙箱保证。
