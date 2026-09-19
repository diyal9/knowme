# RQA186：历史连接器真实调用证据

日期：2026-09-09

## 读取范围

审计只读取 `%APPDATA%/KnowMe/agent-runs/*/events.jsonl` 与对应
`checkpoints/latest.json` 中的运行状态、工具名称和成功/失败状态，不读取工具参数中的
令牌、密钥或敏感正文。

## 当前用户数据结果

| 连接器 | 成功完成运行 | 成功工具调用 | 失败工具调用 | 证据等级 |
|---|---:|---:|---:|---|
| Feishu | 4 | 7 | 0 | `completed_run_tool_calls` |
| Pango Image MCP | 4 | 7 | 3 | `completed_run_tool_calls` |

Feishu 的历史成功调用包括会议候选、会议读取和今日优先事项；Pango 的历史成功调用包括
`list_paint_models` 与 `generate_image`。Pango 同时保留 3 次失败调用，不能把历史成功解释为
当前连接器始终健康。

## 判定边界

- 历史完成运行和 checkpoint 成功调用证明连接器曾在可用的 KnowMe 会话中真实工作。
- 当前沙箱仍无法读取原桌面 keychain/安全存储，因此实时探针的 `auth_required` 或 `offline`
  只能归类为“当前环境不可复核”。
- 历史证据不会提升当前路线回执、Provider 资格或独立专业评审资格；生产门禁仍要求在正常
  KnowMe Electron 用户环境重新取得当前回执。

