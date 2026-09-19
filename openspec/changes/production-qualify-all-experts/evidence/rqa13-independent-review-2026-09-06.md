# RQA13 独立增量复核

日期：2026-09-06。结论：本轮有限评审评价边界通过独立复核；未发现已测范围内的新阻断问题。不是完整语义核验、真实QA重跑或专家生产认证。

## 范围与红绿证据

只读审阅主线 `src/lib/agent-claim-source-check.ts` 的 labelledClaims/checkProvidedFieldClaims 增量。审阅者未修改src、包、权限、QA或评分；未运行fullcheck/API。此前20项红测为14通过、6失败，详见同目录 `rqa13-independent-red-review-2026-09-06.md`，该历史记录保留不覆盖。

主线修正后原20项及64项旧回归共84/84绿。审阅者再于独占测试文件追加两组：来源中的裸结论/括号评价可引用；嵌套、错配、空、重复括号以及附带事实不豁免。最终结果 **86 tests，86 pass，0 fail，0 skip，0 todo，exit 0**；其中RQA13为22项。

```powershell
node -r ./scripts/register-ts.js --test tests/rqa13-review-assessment-boundary.test.js tests/rqa12-claim-source-review.test.js tests/rqa12-tool-source-body.test.js tests/rqa12-provided-material-claims.test.js tests/rqa12-grounding-materials-integration.test.js tests/agent-grounding-runtime.test.js tests/agent-grounding-tool-receipts.test.js
```

## 源码核对与合格边界

- 输出端默认includeAssessments=false；仅结论字段、精确本地前缀（空/评审/本次评审/本轮评审/本评审）、完整有限verdict或单层配对括号verdict可豁免。RR01报告字符串`评审结论：阻塞（需修改）`现正常通过；无expertID分支。
- 原clause含显式方括号citation即不作本地评价豁免，避免normalizeField剥离引用后洗掉归因。会议/客户归因仍校验；真实匹配来源可支持，并非一律拒绝归因。
- 来源抽取显式includeAssessments=true保留评价。已测裸结论、带本地前缀及括号评价均可引用；相同R1可通过、R1不一致不能借R2，前置/尾部citation均覆盖。
- 括号词法完整匹配，不接受嵌套、中英文错配、空括号、两个括号组或尾随实质事实。括号内负责人/日期仍触发字段校验，内部或后续执行声明仍需回执。
- 相邻字段在逗号、分号、换行、同排表格分隔下独立校验；全文泛建议不授权无据字段，评价不满足requiredTools。旧来源绑定、工具正文、无关工具、材料/执行回执边界回归保持通过。

## 限制及冻结

只证明这些有限标题/词法/片段匹配的行为，不保证任意paraphrase、无标签散文、完整归因关系、跨章节一致性或评审专业质量。includeAssessments只保留原评价字段，不赋予来源权威性或额外执行授权。既有局部未知/建议处理与全部自然语言变体未被穷尽；不以当前全绿代替主线真实QA与最终全量门禁。

前序GitNexus提供GROUND调用关系下界，但FTS/覆盖受限；新测试impact为UNKNOWN。审阅者没有修改既有生产符号，不把共享工作区CRITICAL统计归因于本轮。

最终核对SHA256：

- 主线源码 `src/lib/agent-claim-source-check.ts`：`5CC1F9E43413D26974D2322F1BC6A9EA6D6AEF4C399B35A651B0DD700AF2EF8D`
- 独立 `tests/rqa13-review-assessment-boundary.test.js`：`37B25292D6040A143CA82B07FBE540F1A962A2E9C63435E5566C7E34E1DFCCDE`
- 原冻结RQA12独立测试仍为：`91B023B226F042DB8FFC9CA2093B680F9323D197B429FD1CF525EA342B76DBBC`

本次绿测复核写入文件仅 `tests/rqa13-review-assessment-boundary.test.js`（新增两组）和本报告；此前红测记录保留。现冻结独立测试及报告，不再追加；后续发现先报告主线。
