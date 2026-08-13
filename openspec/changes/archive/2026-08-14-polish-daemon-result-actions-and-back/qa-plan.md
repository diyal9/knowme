# QA Plan — polish-daemon-result-actions-and-back

## Smoke Scope

1. 打开任意已完成的 Daemon 管线任务（结果阶段）。
2. 确认结束态卡片底部「回到货架 / 再跑一次 / 查看执行过程」水平居中。
3. 点右上「返回」→ 进入管线服务 · 管线任务列表（非货架）。
4. 再进同一任务结果页，点「回到货架」→ 进入工作流货架。
5. 运行中若出现 Gate/澄清：左栏对话出现 HITL 卡，可在对话中决策/提交澄清。

## Anti-patterns

- 顶栏返回误回货架或任务首页
- 「回到货架」与顶栏返回行为混淆
- 结束态按钮仍右对齐
- 运行中 HITL 退回右下「回答」弹窗

## Evidence

- `evidence/dev-self-test.md`
- 契约：`tests/workbench-templates.test.js`（居中 CSS + 返回分流函数）
