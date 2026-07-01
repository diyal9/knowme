---
name: sticky-agent-memory
description: >-
  StickyNotes 本地会话记忆：用户指正、产品约定、开发习惯；日/周/月摘要；≥3 次重复提示升
  OKF 或建 Skill。Hook 自动落盘，存储在用户目录（非 git）。
---

# StickyNotes Agent Memory

可复用记忆协议：**Hook 落盘 + Agent 加载 + 升库门阀**。  
设计移植自 th-bi-agent-memory，升库目标为 `brain/knowledge/`（OKF）。

## 何时读取

| 场景 | 动作 |
|------|------|
| 会话开场（复杂任务） | 读 [loading.md](references/loading.md) |
| 用户指正 / 讲产品约定 | 读 [episode-schema.md](references/episode-schema.md) |
| 会话结束 / compaction 前 | 确认 Hook rollup；高价值片段可补 working |
| `pending_prompts.jsonl` 有待处理 | 读 [promotion.md](references/promotion.md) 并询问用户 |
| Story 完成后 | 配合 `/kb-ingest` 升格团队 OKF |

## 存储根路径

由 `.cursor/hooks/memory_paths.py` 解析：

1. `STICKY_MEMORY_ROOT`（可含 `{workspace_id}`）
2. Windows：`%LOCALAPPDATA%\sticky-notes\memory\<workspace_id>\`
3. Linux：`$XDG_DATA_HOME/sticky-notes/memory/<workspace_id>/`

关闭：`STICKY_MEMORY=0`

## 与团队知识边界

| 层级 | 位置 | 谁写 |
|------|------|------|
| 个人记忆 | 上述本地根 | Hook + Agent（无需每次确认） |
| 团队 Wiki | `brain/wiki/` | 用户确认后 ingest |
| 团队 OKF | `brain/knowledge/` | 用户确认后 `/kb-ingest` |
| 技能 | `.cursor/skills/**` | 制作人批准 + `/evolve` |

**禁止**把未确认的个人记忆当作团队口径。与 OKF spec 冲突 → 并列差异。

## 渐进披露

| 需求 | 读取 |
|------|------|
| 目录树、保留策略 | [storage-layout.md](references/storage-layout.md) |
| Episode 分类 | [episode-schema.md](references/episode-schema.md) |
| 日/周/月摘要 | [summarization.md](references/summarization.md) |
| ≥3 次指纹 | [pattern-detection.md](references/pattern-detection.md) |
| 升 OKF / 建技能话术 | [promotion.md](references/promotion.md) |
| StickyNotes 升库映射 | [sticky-promotion-map.md](references/sticky-promotion-map.md) |
| 会话加载顺序 | [loading.md](references/loading.md) |

## Hook 集成

`.cursor/hooks/memory_cursor_hook.py`：

- `sessionStart` — bootstrap + 注入上下文
- `beforeSubmitPrompt` — 采集用户输入、更新 pattern
- `afterAgentResponse` — 采集答复
- `postToolUse` — 注入相关记忆片段
- `sessionEnd` / `stop` / `preCompact` — 日/周/月 rollup

## 执行红线

1. **禁止**未经用户确认写入 `brain/knowledge/` 或新建 Skill
2. **禁止**写入 API Key、密码（Hook 脱敏，Agent 亦须自检）
3. 同一 pattern **7 天内只提示一次**
4. 用户指正（`correction`）优先于 Agent 先前推断
