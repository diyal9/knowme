# RQA152：文本专家隔离生命周期重跑

日期：2026-09-09

## 范围

使用 `scripts/qualification-text-fixture-server.js` 提供本地同构 LLM 回执，在隔离 KnowMe QA userData 中重跑当前保留专家的文本类资格套件：

- 产品经理：RQA62，PM01–PM08，8/8 lifecycle passed
- 数据分析师：RQA72，DA01–DA08，8/8 lifecycle passed
- 软件工程师：RQA61，SE06–SE13，7/7 lifecycle passed

执行报告：

- `.tmp/qualification-rqa62-text-current/qualification.json`
- `.tmp/qualification-rqa72-text-current/qualification.json`
- `.tmp/qualification-rqa61-text-current/qualification.json`

## 结果

| 专家 | 用例 | 生命周期通过 | 运行失败 | 环境阻塞 | 独立语义评审 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 产品经理 | 8 | 8 | 0 | 0 | 8 pending |
| 数据分析师 | 8 | 8 | 0 | 0 | 8 pending |
| 软件工程师 | 7 | 7 | 0 | 0 | 7 pending |

执行器同时覆盖当前题集声明的正常、边界、重试、修改与重开生命周期；没有创建生产 userData，也没有把夹具输出转写为真实外部工具或专业质量证据。

## 资格边界

这是运行时生命周期证据，不是生产资格结论。文本夹具只验证任务编排、对话持久化、恢复和状态机闭环，不证明：

1. 模型输出满足每个专家题集的专业断言；
2. 软件工程师实际修改代码、运行测试或产生真实代码回执；
3. 产品和数据结论经过独立专业人员/不同模型评审；
4. 真实 Provider、外部连接器或线上数据可用。

因此三份报告仍为 `professionallyQualified=0`，并保留 `semanticReviewPending`，符合生产门禁要求。

