# RQA71：最终 6 个专家资格覆盖矩阵

日期：2026-09-08

## 矩阵门槛

每个保留专家必须至少覆盖：`normal × 2`、`edge × 1`、`retry × 1`、`revision × 1`、`reopen × 1`。生命周期名称和历史 Skill 评测不能替代缺失场景。

## 当前盘点

| 专家 | 用例数 | normal | edge | retry | revision | reopen | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| product-manager | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| office-partner | 8 | 4 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| research-analyst | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| software-engineer | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| data-analyst | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| image-producer | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |

## 结论

- 当前 6/6 专家具备完整的生命周期题集覆盖，可以开始隔离 Electron 实测，但不能据此宣称专业资格通过。
- 数据分析师已补齐 DA01–DA06 题集；办公协作、研究分析、软件工程和生图也已补齐缺失场景，但六者都还没有本轮真实运行资格证据。
- 缺口已经由机器检查器稳定复现，不再依赖人工翻阅历史报告。
- 下一步按六个专家逐套执行隔离 Electron，随后提交独立语义评审；当前环境没有可用外部模型凭据，不能用离线答案冒充专业实测。

机器报告：[rqa71-retained-expert-qualification-matrix-2026-09-08.json](./rqa71-retained-expert-qualification-matrix-2026-09-08.json)
