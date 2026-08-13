# QA Plan: harden-workbench-chat-fact-citations

## Smoke Scope

- 工作台 Daemon/任务对话：回答后可见「引用来源」
- 解释卡点不编造外部审批角色
- 助手模式无强制任务事实来源条

## Cases

1. 打开等待澄清的任务 → 问「现在卡在哪」→ 依据任务事实作答 + 来源含任务事实
2. 有产物时引用产物 → 来源列表含产物路径
3. 切回助手 Tab → 无工作台 citation 空壳
