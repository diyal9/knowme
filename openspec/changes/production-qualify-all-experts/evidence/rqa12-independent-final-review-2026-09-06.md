# RQA12 独立最终复核与冻结

日期：2026-09-06。结论：本轮已报告的确定性反例均通过回归；可交主线最终 fullcheck。本报告不是全量门禁通过证明，也不是专家生产认证。

## 范围与归属

- 独立审阅 `src/lib/agent-claim-source-check.ts`、`agent-grounding-ledger.ts`，本次最终增量为 `tool-source-content.ts` 及其调用接线；只读核对 GROUND 首次及再生成检查传入同轮 toolMessages。
- 审阅者此前仅新增/维护 `tests/rqa12-claim-source-review.test.js`，现共23项；主线实现生产修正及其余测试。最终轮未改任何源码或测试，仅新增本报告。
- 不改包、评分、冻结输入、UI、权限或执行门禁；未调用真实 API，未读写 QA/profile/APPDATA，未运行 fullcheck，未 commit。
- 前序 GitNexus 调用关系查询受 FTS/索引覆盖限制；全工作区 detect_changes 的 CRITICAL 属共享大范围改动，不能作为本报告独立改动的影响半径。最终结论依据当前源码与真实函数/运行时定向测试，不宣称图谱已证明所有调用路径。

## 已确认修正

1. 成功工具不再整体放行事实：无关 calculate、空搜索、附加无来源字段均不能作为该字段的依据。
2. 来源ID使用边界匹配，未知方括号引用不回退，尾部引用不污染字段值；逗号成员不再被截去。文档 alias 只接受请求/返回同key且精确相等，不借旧 substring binding，也不借跨key相等值。
3. Markdown纯评审结论、明确建议、有限未知状态保持局部处理；完整静态前置引号句的豁免不能遮蔽其它实际执行声明。材料不是执行回执。
4. 同轮成功、非 discovery ledger entry 与 raw tool message 的 toolCallId/toolName 双匹配且 message status=done 时使用完整正文。长纯文本/JSON尾部与原始换行可支持精确字段；错call/tool、失败或缺ledger、额外无据字段仍拒绝。仅有digest时不能证明丢失的尾部。
5. 空结果列表伴随 total/count=0 不再因零计数被认作正文；独立标量零值仍是有效结构化结果。结构化结果有效不等于能证明负责人。
6. 最新 `toolSourceContent` 对对象/数组递归过滤 query、args、request、meta、requestId、durationMs、elapsedMs。此前 `data.request.query` 空搜索回显反例已拒绝；嵌套真实content支持对应字段，但不支持同级query中的姓名。深度超过12或访问节点超过4096时最终返回空content，未保留部分可用片段。

## 精确验证

在仓库根运行以下命令，结果 **64 tests / 64 pass / 0 fail / 0 skip / 0 todo，exit 0**：

```powershell
node -r ./scripts/register-ts.js --test tests/rqa12-claim-source-review.test.js tests/rqa12-tool-source-body.test.js tests/rqa12-provided-material-claims.test.js tests/rqa12-grounding-materials-integration.test.js tests/agent-grounding-runtime.test.js tests/agent-grounding-tool-receipts.test.js
```

其中独立23项全绿，tool-source-body六项包含主线新增两项嵌套包装回归。另用不落盘 `node -e` 探针确认13层包装以及4097元素数组最终均返回空content；未新增测试文件或修改冻结断言。

此前两项红测（合法资源引用误拦、空搜索query回显漏拦）及随后只读报告的嵌套request回显均已闭合。本次未扩展新的自然语言反例或真实模型评测。

## 既有限制与合格边界

- 这是有限标签字段的精确片段匹配及执行凭据检查，不是事实真值/权威性判断；不保证任意paraphrase、无标签散文、分离表头表格、跨章节语义一致性。通过检查不能证明材料内容真实，也不能证明专家专业合格。
- 过滤是列举字段名的结构处理，不保证任意provider字段或未知包装的语义来源。源文本须来自可信运行时路径；模型自报成功或用户材料不应升级为操作回执。
- 深度/节点预算限制的是内容提取结果；JSON.parse在访问计数前运行，宽数组遍历也非超限即整体中止。因此不把该预算描述为原始输入字节、解析CPU或内存的完整硬上限。
- 不可解析JSON按原始文本处理；只有压缩digest而没有匹配全文时，截断和换行丢失仍可能使字段无法确认。当前同轮全文路径已通过，不由此保证历史恢复/所有provider形状。
- alias新增精确约束不等于重写旧资源binding规则；本轮未放宽allowlist、资源ACL或其它执行权限。
- 用户材料接线由另一协作者实现；本轮现有集成测试覆盖同轮材料、再生成、旧run拒绝及SOP不作为材料，不能据此宣称所有任务持久化路径均已穷尽。

## 冻结快照

以下为最终复核时SHA256。源码归主线，本表仅标识审阅版本，不表示审阅者拥有其修改权。

| 文件 | SHA256 |
| --- | --- |
| src/lib/tool-source-content.ts | 8F7FFB15FB3CA7228C14C563CD18C715E7D89E3BAF2ABB0F8CA5811A709DD2D2 |
| src/lib/agent-grounding-ledger.ts | C0961EAFB42321F2F78D0A4AAC715446F6134884F2B9D775608713F45A824767 |
| src/lib/agent-claim-source-check.ts | 4BD49F7A193DEA033EC41F1AFC431FC21732A907EAA6422710EB0DFAE2CAB09F |
| tests/rqa12-claim-source-review.test.js | 91B023B226F042DB8FFC9CA2093B680F9323D197B429FD1CF525EA342B76DBBC |

独立测试维持此前冻结hash，不再追加；本报告落盘后审阅者工作冻结。后续发现先报告，由主线决定是否重新打开范围。全量门禁由主线统一执行。
