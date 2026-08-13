# QA Plan — align-daemon-chat-progress-hitl-artifacts

## Smoke Scope

1. 打开进行中的 Daemon 任务 → 左栏出现「管线进度」卡（当前步 / 比例 / 状态）。
2. need_input 任务 → 左栏「待处理事项」列出具体问题，卡内可填写并「提交答复」。
3. Gate 等待 → 卡内通过 / 修订 / 打回。
4. 进度卡「查看过程日志」→ 右栏切到过程日志 Tab。
5. 制品 Tab → 行样式为「预览 | 路径 | 大小」。

## Anti-patterns

- 左栏只剩助手「执行过程」而无管线进度
- 澄清卡无具体问题（仅「请补充」）
- 制品仍为图标+名称堆叠旧布局
- 全文 daemon.log 重新灌回对话

## Evidence

- `evidence/dev-self-test.md`
