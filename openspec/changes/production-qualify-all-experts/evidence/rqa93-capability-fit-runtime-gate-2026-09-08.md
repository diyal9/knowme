# RQA93 — 能力不匹配的运行时闭环

日期：2026-09-08

## 目标

任务命中一个已声明路由集合但没有命中任何专项路由时，必须在模型和工具调用前暂停；用户补充新的目标范围后，运行时重新匹配路由。若仍不匹配，继续保持待处理，不能生成伪成果。

## 实现

- 专家任务创建预检和恢复执行均识别 `executionRouteFit === 'unmatched'`。
- 未匹配时状态为 `needs_input`，attention 使用通用 `capability_unavailable/provide_input`，不调用模型、不调用连接器。
- 用户补充内容会追加到计划步骤，作为下一次通用路由匹配线索；不修改专家 ID，也不增加专家特判。
- 执行合同显式记录 `executionRoute`、`executionRouteMatch` 和 `executionRouteFit`，便于审计与调试。

## 验证

- `node -r ./scripts/register-ts.js --test tests/expert-task-runtime.test.js --test-name-pattern='pauses an unmatched declared route'`
- 结果：38/38 通过（含现有专家任务运行时回归和新增场景）。
- 场景验证：第一次任务目标为海报设计时在执行前暂停；输入“只整理今日日程”后命中日程路由并进入 review；模型调用次数为 1。

该门禁解决的是 KnowMe 通用运行时的能力边界和异常闭环，不替代各专家真实 Provider 执行与专业质量认证。
