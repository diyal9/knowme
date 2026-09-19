# RQA91 — 通用专家能力适配门禁

日期：2026-09-08

## 目标

把“当前任务是否配得上专家能力”纳入 KnowMe 通用运行时契约，而不是为某个专家增加特判。执行路由现在明确记录三种匹配结果：专门关键词命中、声明条件命中、默认路由兜底，以及完全未命中。

## 实现

- `selectExecutionRouteWithMatch` 返回路由和匹配来源；保留 `selectExecutionRoute` 的既有返回值，避免破坏调用方。
- 输出契约增加 `executionRouteMatch` 与 `executionRouteFit`：`matched`、`fallback`、`unmatched`、`unconfigured`。没有声明路由的专家不会被误判为能力不匹配。
- 未命中任何路由时，运行时提示专家先做能力边界判断；不适配必须说明并停止，不得用相邻能力硬做。
- 命中默认路由时，运行时提示专家核对目标、交付类型和所需能力；不匹配时先说明边界。

## 验证

- `node -r ./scripts/register-ts.js --test tests/expert-execution-profile.test.js tests/expert-task-runtime.test.js`
- 结果：49/49 通过。

该门禁只负责通用能力适配判断，不等同于远程 Provider 的真实专业资格认证；真实生图和各专家专业质量仍需在获得明确远程调用授权后执行隔离资格套件。
