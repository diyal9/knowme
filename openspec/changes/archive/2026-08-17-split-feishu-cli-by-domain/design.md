## 拆分域

| 模块 | 职责 | 不负责 |
|------|------|--------|
| `feishu-cli/core.ts` | spawn/retry/sanitize、READ/WRITE 常量、`runLarkCli*`、`executeFeishuRead`、`buildReadArgs` | 工作流编排 |
| `feishu-cli/scopes.ts` | `parseMissingScopeError`、`getGrantedUserScopes`、`resolveCurrentUserIdentity` | CLI spawn |
| `feishu-cli/meetings.ts` | vc/minutes 会议候选与读取 | IM/日历 |
| `feishu-cli/im.ts` | @我 消息检索与 related_chats 格式化 | 发消息写操作 |
| `feishu-cli/calendar.ts` | 日程/待办/today_priority | 云盘检索 |
| `feishu-cli/drive.ts` | drive/wiki/doc_kb_suggest | 草稿写入 |
| `feishu-cli/write.ts` | list/send、draft builders、`applyFeishuWrite` | 只读 search |
| `feishu-cli/tool-defs.ts` | `FEISHU_*_TOOL_DEFS` 静态定义 | 运行时逻辑 |

## 依赖方向

```
core ← scopes ← meetings / drive
core ← write (contact)
core + scopes + write.list ← im
core + scopes + im ← calendar
meetings ← write (extractMinuteToken for minute permission draft)
```

## 兼容

- `feishu-cli.ts` 仅 `require('./feishu-cli/*')` 并 spread 相同 export 键。
- 不新增对外路径；测试与 `tool-runtime` 无需改 import。
