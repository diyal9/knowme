# Dev self-test: move-daemon-hitl-into-chat

## 命令

- `npm test` — PASS **1777/1777**
- `npm run lint` — ok

## 覆盖点

- [x] `workbench-task-brief` Gate/澄清 nextAction 引导左侧对话
- [x] 无 `actionButton('daemon-clarify'` 底栏回答按钮
- [x] `workspace-agent`：`syncDaemonHitlFromContext` / `daemon-hitl` / `submitDaemonClarificationAnswer` / Gate `data-daemon-hitl-decision`
- [x] `knowme-daemon-hitl-submitted` → workbench `refreshDaemonTask`
- [x] HITL 样式 `.agent-daemon-hitl` 在 `workspace.html`
- [x] 澄清卡优先读 Daemon API `questions[]`，再读 `.dispatch/{node}.return.txt`
- [x] 过滤技术态：`answer file present` / `awaiting` / `TIMEOUT` / `question sent to` 等
- [x] 过滤元问题「需要我补充什么？」；答复文件（`# 澄清答复`）不当作问题正文
- [x] 真实 `rdpi-ff-zero-gift` return.txt 可解析出 2 条可读问题

## 手动体验（建议）

1. 打开等待 need_input 的 Daemon 任务 → 左栏澄清卡应展示 `questions` 正文（非 `answer file present`）
2. 输入框回复并发送 / 点「提交澄清」→ 任务继续
3. Gate 等待 → 对话卡点通过/修订/打回
4. 问「要补充什么」→ 助手说明，不自动提交
