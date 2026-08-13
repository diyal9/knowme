# QA Plan — clarify-workflow-run-status-surface

## Smoke Scope

- 货架 → 开始 → 确认输入：顶栏无「返回货架」；取消可回
- 启动运行后：顶栏有 Outcome Pill；步进为阶段
- 失败任务：Pill=失败，步进可仍为执行中，meta 非「执行失败」独句
- 底栏「返回流程」可回货架

## 反模式

- 同屏两个冲突全局状态色
- 删退路导致无法离开运行视图
