# Agent 写盘策略说明

与根目录 [rdpi-agent-workspace-policy.yaml](../../rdpi-agent-workspace-policy.yaml) 及 [`.cursor/rules/bi-agent-filesystem-scope.mdc`](../../.cursor/rules/bi-agent-filesystem-scope.mdc) 一致。

## 工作区交互人设（与写盘角色解耦）

| 维度 | 存储 | 说明 |
|------|------|------|
| `workspace_persona` | Agent memory `profile.yaml` | `user`（使用者）/ `developer`（开发人员）；默认 `user` |
| 切换 | `/th-bi-switch-mode` | 见 [th-bi-workspace-mode SKILL](../../.cursor/skills/th-bi-workspace-mode/SKILL.md) |

**开发人员人设 ≠ maintainer**。`.env` 仅工程配置（Langfuse 等），不存 persona。

## 角色（写盘）

| 环境变量 | 角色 | 默认写盘 |
|----------|------|----------|
| 未设置或 `operator` | 分析操作者 | `kb/okf/**` |
| `maintainer` | 维护者 | 上表 + 用户书面列路径与 YAML 白名单交集 |

## raw/ 只读

`raw/**` 正文对所有 Agent **只读**。例外：`raw/sources-index.md` 可在 ingest 时由 operator 更新清单行。

## maintainer 扩写

须同时满足：

1. `TH_BI_AGENT_ROLE=maintainer`
2. 用户**书面列出**拟写路径
3. 路径落在 YAML `extra_write_globs_when_user_lists_paths` 与白名单交集内
4. 写前说明路径、范围、原因并获确认

## Git

Agent 默认不 `git commit`；用户明确要求时才提交。
