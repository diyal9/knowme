# RQA158：文本专家专业候选夹具重放

日期：2026-09-09

## 目标

修正文本资格夹具原先对所有专家返回同一段占位摘要的问题，使本地生命周期测试至少拥有可供独立评审的专业候选正文，并覆盖数据分析师声明的 `calculate` 工具路线。

## 实际重放

使用同一个隔离文本 Provider，分别执行完整冻结题集：

| 专家 | 题集 | 结果 | 运行失败 | 环境阻塞 |
|---|---|---:|---:|---:|
| 产品经理 | RQA62 PM01–PM08 | 8/8 review | 0 | 0 |
| 数据分析师 | RQA72 DA01–DA08 | 8/8 review | 0 | 0 |
| 软件工程师 | RQA61 SE06–SE13 | 7/7 review | 0 | 0 |

数据分析师 `DA01` 额外确认：

- 执行路线为 `data-analysis-method`；
- 首轮调用 `calculate`；
- 工具回执状态为 `ok`；
- 随后才交付带有总体、分渠道算式、因果边界和最小验证方案的正文；
- canonical artifact 正文 `bodyChars=346`。

## 夹具质量边界

夹具现在按专家类型和题面生成不同候选：产品经理输出 PRD 的目标/范围/状态/异常/验收结构，数据分析师输出可复算数字和证据边界，软件工程师输出实现或架构/测试形态。新增防回退单测与工具协议单测，合计 `6/6` 通过。

这仍是确定性本地夹具，不是生产模型；候选正文尚未经过独立人类或不同模型的逐条语义评审，因此所有报告继续保持 `pending_independent_review`，不提升 `professionallyQualified` 或 `productionReady`。

## 报告

- `.tmp/qualification-rqa158-pm/qualification.json`
- `.tmp/qualification-rqa158-da/qualification.json`
- `.tmp/qualification-rqa158-se/qualification.json`
