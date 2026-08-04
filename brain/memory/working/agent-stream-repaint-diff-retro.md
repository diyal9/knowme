# Retro: agent-stream-repaint-diff

- 日期：2026-08-03
- 归档：`openspec/changes/archive/2026-08-03-agent-stream-repaint-diff/`
- 要点：流式 Markdown 改为块级增量重绘（稳定区保留节点身份，仅更新 `.md-stream-tail`）；首 token 就地升级思考气泡，避免会话列表全量重绘。
- 时间线：执行过程卡片按行增量更新，计时 tick 只改耗时文本，保留用户展开/折叠态，避免 pulse 动画重启。
- 同步 capability：`agent-chat-ux`、`agent-thinking-timeline`。
