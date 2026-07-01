# Episode Schema

每条情节为一行 JSON（JSONL）。

## 字段

| 字段 | 说明 |
|------|------|
| `id` | uuid |
| `ts` | ISO8601（东八区） |
| `conversation_id` | 会话 id |
| `kind` | 见下表 |
| `user_text` | 用户原话（脱敏截断） |
| `agent_summary` | Agent 答复摘要 |
| `meta` | 工具名、change、hook 事件 |
| `confidence` | `user_stated` / `agent_inferred` |

## kind 枚举

| kind | 含义 | 写入 working |
|------|------|--------------|
| `correction` | 用户指正 | ✅ |
| `product_theory` | 产品/架构/Electron 约定 | ✅ |
| `habit` | 偏好、默认习惯 | ✅ |
| `dev_workflow` | 开发/测试/OpenSpec 工作流 | ✅ |
| `general` | 其他 | ❌ |

## 分类启发式（Hook）

- **correction**：不对、应该是、纠正、指正…
- **product_theory**：便签、Electron、IPC、OpenSpec、架构、验收…
- **habit**：习惯、默认、偏好、以后都…
- **dev_workflow**：Shell/MCP 工具链、npm test、opsx

## 指正格式（推荐）

```text
错误：<Agent 先前说法>
正确：<用户纠正>
依据：用户陈述 | OKF <链接>
```
