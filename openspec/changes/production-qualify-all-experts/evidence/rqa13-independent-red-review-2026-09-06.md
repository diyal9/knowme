# RQA13 独立红测记录

日期：2026-09-06。本轮只新增独立测试和本记录；不修改src、既有RQA12测试、包或评分。不运行fullcheck、真实API或QA操作。

## 复现与结果

```powershell
node -r ./scripts/register-ts.js --test tests/rqa13-review-assessment-boundary.test.js
```

结果：20 tests，14 pass，6 fail，0 skip，0 todo，exit 1。失败为以下应允许的本地评价：

- `评审结论：阻塞（需修改）`（主线报告的真实RR01字符串；本测试未重跑QA）
- `结论：阻塞（需修改）。`
- `本次评审结论：阻塞（需修改）。`
- `本轮评审结论：有条件通过（待补充）。`
- `本评审结论：需修改。`
- `## 评审结论：阻塞(需修改)`

RR01字符串实际结果：passed=false；fieldChecks中prefix=评审、label=结论、value=阻塞（需修改）、support=unresolved；violation=ungrounded_external_fact。现有bare `结论：需修改`通过。

其余14项包括归因会议/客户仍校验、确实同源归因可引用、实质结论不豁免、括号事实/负责人/日期不豁免、未授权执行独立拒绝、逗号/分号/换行/表格同排相邻字段独立检查、全文泛建议不放行、未知citation不能洗掉、同源纯评价引用正例、引用与源不一致且不能借R2负例、requiredTools不被评价满足及有限检测范围声明。

## 建议的最小安全边界

1. 不依赖expertID。输出端仅label=结论、规范化后的prefix精确属于空/评审/本次评审/本轮评审/本评审时考虑本地评价豁免；会议、客户等归因不进入该集合。按主线最新收窄范围，不额外要求本文前缀。
2. 值必须完整匹配现有有限verdict或阻塞，可带一层由有限verdict构成的括号补充。不能用“包含通过/修改”代替整值匹配；括号实质事实、负责人、日期、执行声明不作为评价词。
3. 在normalizeField剥离citation之前记录原clause是否有显式来源引用；有引用时不作本地评价豁免。来源绑定继续精确匹配，未知来源不得回退。
4. 输出端本地评价识别与来源字段抽取分离。来源端includeAssessments=true保留原结论字段，以支持`[R1]评审结论：通过`确实引用R1的情况；相反R1为不通过、R2为通过时不得借R2。源码接口由主线实现，本测试不绑定具体helper签名。
5. 豁免只作用于这个评价字段；不得跳过相邻字段、全篇执行声明、requiredTools/evidence或OutputGate。来源中有评价不代表操作已执行。

这只是有限标签字段及来源片段校验，不保证评价专业正确、事实真值、任意paraphrase或完整自然语言归因识别。

## 审计与边界

- 测试SHA256：`1E786C05F68F3D0852725A27D0FABD072D4C60118D42C6AC0F9ED4F62B4D7017`。
- 红测时`src/lib/agent-claim-source-check.ts` SHA256：`4BD49F7A193DEA033EC41F1AFC431FC21732A907EAA6422710EB0DFAE2CAB09F`。
- GitNexus query的FTS降级；context提供verifyClaims至GROUND调用关系的下界。新测试文件未索引，impact=UNKNOWN，不将其视为零影响。无既有函数修改。
- detect_changes报告共享工作区305文件、569符号、160受影响、CRITICAL；不能归因于本轮两个新增文件，也不据此宣称全工作区安全。
- 本轮新增文件：`tests/rqa13-review-assessment-boundary.test.js`及本记录。测试保留期望行为红断言，未skip/todo或修改生产实现使其通过；后续绿测由主线实施后验证。
