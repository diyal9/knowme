# Workflow v1（ingest / query / lint）

Canonical 执行步骤。与 [info/conventions/okf-kb-operations.md](../../../../info/conventions/okf-kb-operations.md) 一致。

## A. 会话开场

1. Read `SKILL.md` + 按需 [first-turn-templates.md](first-turn-templates.md)
2. 复杂任务：确认 project_id、分析目标、是否 ingest / query / lint

## B. Ingest

| 步骤 | 动作 |
|------|------|
| B1 | 确认 raw 路径符合 [raw-archive-layout-ref.md](raw-archive-layout-ref.md) |
| B2 | 读 `raw/` 指定文件（只读） |
| B3 | 提取：Metric / Event / Dimension / Table / Playbook 候选 |
| B4 | 可选：MCP `list_events` / `list_event_properties` / `list_dimensions` 校验 |
| B5 | 写/更新 `kb/okf/**/*.md`，**双向补链**（按 raw 分区 §4 映射） |
| B6 | 冲突 → `synthesis/conflicts/{slug}.md`，`status: open` |
| B7 | 更新各级 `index.md` + 根 `log.md` |
| B8 | 向用户汇报：touch 的 Concept 列表 + 待确认 open 项 |

## C. Query

| 步骤 | 动作 |
|------|------|
| C1 | 读 [kb/okf/index.md](../../../../kb/okf/index.md) |
| C2 | 展开 3–5 个 linked Concept |
| C3 | **要数字**：读 Metric `# TE Query Hint` → [te-mcp-analysis-integration.md](te-mcp-analysis-integration.md) → TE builder → `query_adhoc` |
| C4 | 可选：Cherry KB `search_knowledge` |
| C5 | 合成答案，标注 Concept 引用 |
| C6 | 若答案可复用 → 提议写入 `synthesis/` |

## D. Lint

| 步骤 | 动作 |
|------|------|
| D1 | 扫描 Metric 缺 `implemented_by` / Event 缺 `lands_in` |
| D2 | 查 open Conflict 被引用情况 |
| D3 | 孤儿页、断链列表 |
| D4 | MCP spot-check：盘古（用户给 project_id）；TE `list_events` vs Wiki Event（用户给 TE projectId） |
| D5 | 输出报告；可选写入 `log.md` |

## E. 写盘确认（operator）

写入 `kb/okf/**` 前：

- 路径列表
- Concept ID 列表
- 原因（ingest / 用户授权修订）

## F. 改 Wiki 后回执

同一轮答复须含：

1. 实际写入路径
2. 新建/更新的 Concept ID
3. 链接变更摘要
4. 仍为 draft 或 open 的项
