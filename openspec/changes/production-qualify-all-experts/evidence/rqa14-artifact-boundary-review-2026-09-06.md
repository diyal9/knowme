# RQA14 artifact_ready 补充边界评审

日期：2026-09-06。本轮只读核对artifact_ready路径与既有executor artifact保留测试，未改src或测试、未运行模型/API/fullcheck。现有12项desired-red测试保持冻结；此前结果2通过/10失败，不将它报告为实现后的新测试结果。

## 两类完成状态必须分开

- **正文交付**：明确length且修复仍length，不能把截断正文DONE/verified或作为完整答复验收。既有12项测试针对该合同。
- **产物交付**：已成功工具回执和真实artifactRefs满足产物交付契约，仅可选模型说明被截断或生成失败时，可舍弃半截说明，使用可信回执生成确定性摘要。这不等于模型答复完整，也不等于产物专业质量已通过。
- 没有真实产物、仅模型自述“已生成”、只有URL文本或产物契约不满足时，不能借artifact_ready例外整体成功。若还要求独立完整分析正文，产物存在不能替代未完成正文要求。

## 最小安全处理顺序

1. 先处理父取消/返回cancelled：传播CANCELLED，不让通用error分支或artifact fallback覆盖取消。已经形成的产物与回执仍须保留，不撤销已发生事实，但不能把取消改为DONE。
2. 正常stop沿既有流程；null/缺少finishReason保留兼容语义，不根据标点、半句、中文结尾或expertID推断length。stop也不是语义/质量证书。
3. artifact_ready的说明返回明确length时，丢弃该候选正文，不拼接，不再次调用生成工具；已完成真实产物可使用确定性摘要。摘要只陈述受回执支持的产物存在/数量及查看方式，例如“工具已返回1项产物，可查看并验收；模型说明未完整生成。”不得声称质量、安全性、测试或模型说明已经完整验证。
4. 再通过既有完整执行契约与GROUND检查；保留artifactRefs及成功ToolLedger，不使摘要绕过requiredEvidence/ACL/审批/缺失工具条件，也不将审批中或结果未知的操作算作已完成。
5. 保留内部可审计的模型finishReason与确定性摘要来源；若现有结果结构不足可由主线决定字段名。本评审不要求用某个新字段通过测试。

## 当前接线风险与既有覆盖

只读时completedArtifactDelivery主要检查产物数量/类型及requiredTools，不能替代后续完整契约校验。artifact_ready调用finalizeResponse后以`finalized.error || empty fullText`触发摘要；因此**取消终态必须先于通用error/fallback被识别**，显式length也不能因snapshot有正文而沿旧候选正常提交。这里只报告接线边界，不宣称已运行新的artifact取消/length反例。

既有 `tests/agent-run-executor.test.js` 的“preserves a generated artifact when FINALIZE cannot fit fixed records without retrying generation”证明测试设计已要求：生成一次、保留原artifactRefs、允许确定性摘要。它覆盖上下文预算失败，不等于已覆盖length/取消或全部产物合同。主线实现时应保留该边界；未来若补独立测试，可检查artifact引用不变、生成次数仍1、摘要不含截断残片及取消不转DONE，不能放宽正文12项红测来兼容artifact。

## 冻结

独立测试 `tests/rqa14-incomplete-model-response.test.js` SHA256仍为：

`F1B98CDA186BF9D172691265D4F6C93B1E3A9BF96B05AA8F14B679C50C4887C6`

本轮唯一新增文件为本报告。测试与源码均未改动，继续冻结；后续实现及绿测由主线安排。
