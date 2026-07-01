# 模式检测（≥3 次）

## 指纹

`SHA256(kind + meta + 规范化用户文本)[:16]`

meta 常用键：`change_name`、`tool_name`、`mcp_server`

## prompt_state

| 值 | 含义 |
|----|------|
| `pending` | 未处理 |
| `dismissed` | 用户选暂不（7 天内不再问） |
| `promoted_kb` | 已升 OKF |
| `promoted_skill` | 已建技能 |

## 门阀

- `count >= STICKY_MEMORY_PROMPT_THRESHOLD`（默认 3）
- 距 `last_prompted` ≥ 7 天

命中 → `pending_prompts.jsonl` → Agent **询问用户**（不自动升库）。

## kind → 升级方向

| kind | 默认建议 |
|------|----------|
| `correction`, `product_theory` | 升 `brain/knowledge/`（Concept / Decision / Playbook） |
| `dev_workflow` | 升 `processes/` Playbook 或 `.cursor/skills/` |
| `habit` | 更新本地 `profile.yaml` |
