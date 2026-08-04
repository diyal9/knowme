# QA Plan: silent-personalization-strengthen

## Smoke Scope（必填）

- [x] 有协作偏好或已确认习惯时，回复旁出现「本轮沿用了 N 条习惯」且可展开
- [x] 无偏好/无习惯时，不出现空的沿用提示
- [x] 输入框上方不出现记忆勾选芯片
- [x] 快捷入口与普通输入共用 Effective Personalization 摘要
- [x] chat 轻对话路径仍注入限长短偏好摘要

## Regression Scope

- Agent 流式回复、执行时间线、快捷入口发送仍可用
- 设置页「我的记忆」接受习惯后仍可进入注入链路

## Anti-pattern Checks

- [x] 不把「本轮沿用」做成输入框上方勾选条
- [x] 不向用户展开列表暴露注入用机器框架文案
- [x] 不把未确认 telemetry 当成习惯展示
