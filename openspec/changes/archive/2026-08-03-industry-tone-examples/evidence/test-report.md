# QA Test Report: industry-tone-examples

- 日期：2026-08-03
- 执行人：测试（自动化 + 源码冒烟）
- 结果：PASS

## Smoke Scope

- [x] 设置 → 我的记忆可见「行业」下拉，默认「通用办公」
- [x] 切换为「游戏」并保存后，重新打开设置仍为「游戏」（`settings-secure` 持久化单测）
- [x] 「今日优先级」空事实正文含游戏向占位示例，且标明仅为示例
- [x] 行业为游戏时不含销售合同签署类示例
- [x] 有真实飞书事实时不使用空态占位模板（仅 `hasEmptyTodayPriorityFacts` 分支改写）

## Regression

- [x] 「关于我」「协作偏好」字段仍在
- [x] 空态仍隐藏 suggestion bar
- [x] `npm test` / `npm run lint` 全绿

## Anti-pattern

- [x] 占位示例文案含「不是你的真实任务」
- [x] prompt 明确禁止把示例写成推荐任务
- [x] 行业字段不覆盖「关于我」

## 备注

未跑 Playwright 实机截图；建议制作人手测一次完整 UI。
