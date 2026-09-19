# RQA70：独立专业评审契约

日期：2026-09-08

## 目的

把“专家运行时生命周期通过”和“专家专业能力合格”分成两个独立门禁。运行时的质量自检只能帮助当前任务收敛，不能作为最终专家资格证明。

## 实现

- 新增 `scripts/expert-semantic-review.js`，提供通用独立评审导入与校验入口。
- 新增 `npm run eval:experts:review`。
- 评审记录必须覆盖资格报告中的全部用例，并逐条对应冻结的 assertion。
- 每条评审必须包含 `pass`、具体候选稿证据、原因；失败项必须给出 `requiredChange`。
- 评审者必须显式声明 `independent: true`。
- 独立模型不得复用执行任务使用的模型；同一供应商的不同模型是允许的。
- 生命周期失败即使语义评审通过，也不能成为专业合格任务。
- 评审结果会回写 `semanticReview`、`hardAssertionsPassed`、`certificationEligible`，并生成新的 AgentEvals 输入。

## 验证

- 定向测试：25/25 通过。
- 全量 `npm run check`：通过。
  - 后端：3470 项，3419 通过，51 跳过，0 失败。
  - Renderer：86 个文件，608 项通过。
  - lint、typecheck：通过。
- 当前 RQA69 生图资格报告仍为 `semanticReview: pending_independent_review`，没有被本契约自动改写为通过。

## 结论

RQA70 完成的是通用评审基础设施，不代表任何专家已经取得生产资格。最终 6 个专家仍需在真实任务证据上分别完成独立专业评审，当前总目标继续 ACTIVE。
