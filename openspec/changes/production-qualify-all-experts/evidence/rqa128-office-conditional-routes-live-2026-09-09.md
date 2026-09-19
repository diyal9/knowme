# RQA128：办公协作外部读取路由完整运行验证

日期：2026-09-09。使用隔离 Electron 资格入口、办公模型夹具和本机 `lark-cli` 等价夹具，对 `rqa73-office-qualification` 的 4 条条件路由进行真实运行时验证。

## 结果

| 用例 | 路由 | 真实工具回执 | 生命周期 |
|---|---|---|---|
| OP12 | `today-priority` | `feishu.today_priority` 成功 | `review` |
| OP13 | `meeting-summary` | `feishu.meeting_candidates` 成功，仅交付候选 | `review` |
| OP14 | `doc-kb` | `feishu.doc_kb_suggest` 成功 | `review` |
| OP15 | `related-chats` | `feishu.related_chats` 成功 | `review` |

`rqa128-office-live.json`：`4/4` 生命周期通过，运行失败 `0`，环境阻塞 `0`；每条任务均存在匹配的 `executionRoute`、成功工具调用和 EvidenceLedger 回执。

## 发现与修复

通用 OutputGate 的“已读取”声明白名单遗漏了 4 个 Feishu 只读工作流。工具实际成功后，仍被误判为 `false_execution_claim` 并进入 `needs_input`。已在 `src/lib/agent-grounding-ledger.ts` 将以下工具纳入读类工具契约：

- `feishu.meeting_candidates`
- `feishu.today_priority`
- `feishu.doc_kb_suggest`
- `feishu.related_chats`

同时补充 `agent-grounding-runtime` 回归，确保 4 个工具的成功回执可以支撑读取声明。

## 边界

本证据证明 KnowMe 通用运行时、Feishu 路由、工具回执和输出门禁已形成闭环；夹具不代表真实飞书账号授权、真实数据或办公专业质量认证。生产资格仍需真实连接器环境和独立专业评审。
