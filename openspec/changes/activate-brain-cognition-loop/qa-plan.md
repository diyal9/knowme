# QA Plan

## Smoke Scope

- [x] 验证明确信息只生成 Proposal，确认前不写入长期 Brain。
- [x] 验证知识偏好进入 Brain，协作偏好进入 Partner Profile。
- [x] 验证弱观察经 Memory 重复阈值进入同一待确认队列。
- [x] 验证敏感、一次性、问句、未授权、失败与取消场景不学习。
- [x] 验证稳定 fingerprint 去重、拒绝抑制和重复观察计数。
- [x] 验证提案解释、来源、置信度、影响和确认前编辑。
- [x] 验证确认后 Brain 图谱与统计即时刷新。
- [x] 验证 Brain、Partner Profile 两类 Growth 写入统一 Ledger 并可撤销。
- [x] 验证 Memory pattern 在确认、拒绝与撤销后的审核状态回写。
- [x] 验证 1280×800 待确认页面、空状态和最近成长操作。
- [x] 验证 Playwright 完整认知闭环且无浏览器错误。
- [x] 执行 OpenSpec strict、Node 全量测试、lint、Renderer 全量测试和类型检查。

## Regression Focus

- Personal Agent 的旧独立测试夹具保留兼容回退；产品运行时明确教学统一走 Brain Proposal。
- 认知观察失败不得阻断 Agent 正常回复。
- 外部知识检索结果不会因本功能自动写入 Brain。
- `observed` / `inferred` 内容在确认前不能驱动稳定个性化。
