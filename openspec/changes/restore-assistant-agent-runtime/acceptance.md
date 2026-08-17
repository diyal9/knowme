# 制作人体验验收

对照 `f6ad048`：对话过程、气泡排版、停止/发送；Runtime 仍走主进程 executor。

- [x] 发送后可停止；流式 Markdown 可渲染（开发自测 + `restore-assistant-*` / closeout）
- [x] grounding / skillRefs / runId 契约仍由主进程 executor 归约（非纯前端假流）
- [x] 助理列无「返回工作台」Daemon 过程卡（dialogue-parity）
- [x] 飞书/长任务轮次中进度与停止手感与基线一致（制作人真机联调签字）
