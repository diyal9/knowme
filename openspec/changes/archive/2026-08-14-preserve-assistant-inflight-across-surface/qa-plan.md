# QA Plan — preserve-assistant-inflight-across-surface

## Smoke Scope

1. 助理「通用」发送一条消息 → 立即切到工作台 → 再切回助理：用户消息与助手回复（或生成中气泡）仍在；无空白 + 停止卡死。
2. 同上路径切到自动化再回助理：同上。
3. 生成完成后发送按钮恢复为发送；可继续追问。
4. 无进行中 run 时切换 Session / 重启后仍从存储恢复历史。

## Anti-patterns

- 切走再回来变成「开始使用」空态但底部仍是停止。
- 回复生成完但气泡永远不出现。
- 工作台 Session 标题被助理对话污染。
