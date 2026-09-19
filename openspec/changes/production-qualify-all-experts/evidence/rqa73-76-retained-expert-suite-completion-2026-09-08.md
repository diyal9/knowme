# RQA73–RQA76：六个保留专家题集补齐

日期：2026-09-08

## 本轮变化

- `rqa73-office-qualification`：OP08–OP11，补齐办公协作的冲突边界、取消后重试、退回修改和完成后重开。
- `rqa74-research-qualification`：RA05–RA08，补齐研究分析的不可比口径、证据检索重试、范围修订和失效来源重开。
- `rqa75-software-engineer-qualification`：SE11，补齐第二个正常实现题，保持无工具、只交付对话代码与测试设计的配置边界。
- `rqa76-image-producer-qualification`：IP06，补齐第二个正常生图题，明确必须有真实 `generate_image` 回执、可解码 image artifact 和可见图片预览。

## 机器结果

`npm run eval:experts:matrix` 已通过覆盖检查：

| 专家 | 用例数 | normal | edge | retry | revision | reopen | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| product-manager | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| office-partner | 8 | 4 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| research-analyst | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| software-engineer | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| data-analyst | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |
| image-producer | 6 | 2 | 1 | 1 | 1 | 1 | ready_for_live_execution |

## 边界

这是题集覆盖门槛，不是专业能力认证。真实资格仍需在隔离 Electron 中执行，验证当前 Agent、Skill、Connector、模型、工具回执、成果物、异常恢复和生命周期；之后还必须由独立人类或不同模型完成逐条语义评审。当前环境没有可用外部模型凭据，不能用离线生成的答案冒充专业实测。
