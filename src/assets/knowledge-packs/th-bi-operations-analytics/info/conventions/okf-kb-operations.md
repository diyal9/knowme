# OKF 知识库操作约定

本文档为 **全仓共识**：ingest / query / lint 的标准流程。OKF 格式见 [kb/SCHEMA.md](../../kb/SCHEMA.md)；架构见 [kb/ARCHITECTURE.md](../../kb/ARCHITECTURE.md)。

## 1. Ingest（入库）

### 触发条件

- 新文件放入 `raw/`
- 埋点 / 报表 / 口径变更
- 用户明确要求「入库」「更新 Wiki」

### 归档路径（强制）

新资料须按 [raw-archive-layout.md](./raw-archive-layout.md) 落入 `raw/10-*` … `raw/80-*` 规范树；**禁止**在 `raw/` 根下自建未定义文件夹。ingest 映射见该文档 §4。

### 标准步骤

1. **读 raw**（只读，不改写 raw 正文；路径须符合归档规范）
2. **与用户确认**要点（可选但推荐：复杂口径）
3. **写/更新 Concept** 于 `kb/okf/`
4. **双向补链**：Metric ↔ Event ↔ Table ↔ Dimension
5. **冲突**：发现口径不一致 → `synthesis/conflicts/`，`status: open`
6. **更新 index**：受影响目录的 `index.md` + 根 [log.md](../../kb/okf/log.md)
7. **可选 MCP 校验**：盘古 `list_events`、`list_event_properties`、`list_dimensions`

### log 条目格式

```markdown
## [YYYY-MM-DD] ingest | {来源简述}
* **Update**: …
```

## 2. Query（问答）

1. 读 [kb/okf/index.md](../../kb/okf/index.md)
2. 沿链接展开相关 Concept（通常 3–5 个）
3. 合成答案，**引用 Concept ID**（如 `/semantic/metrics/dau.md`）
4. **好答案写回** `kb/okf/synthesis/`（type: Synthesis）
5. 可选：Cherry KB `search_knowledge` 补充长文档

## 3. Lint（健康检查）

用户说「检查 Wiki」「lint 知识库」时执行：

| 检查项 | 处理 |
|--------|------|
| Metric 无 `implemented_by` 且无 draft 说明 | 标记待补或 ingest |
| Event 无 `lands_in` | 标记待对接数仓 |
| open Conflict 被引用为唯一口径 | 警告并建议 resolve |
| 孤儿页（无入链） | 列入待链接清单 |
| Wiki vs MCP 不一致 | 并列差异，请用户确认 |
| Wiki Event vs TE `list_events` | 并列差异（有 TE projectId 时） |

Lint 结果可写入 `log.md`：`## [date] lint | …`

## 4. 写盘边界

- **operator**：`kb/okf/**`；`raw/sources-index.md` 可在 ingest 时更新清单
- **raw/** 正文：所有角色只读
- 详见 [agent-workspace-policy.md](./agent-workspace-policy.md)

## 5. 与 th-config 协同

- 渠道 / 区服 ID 语义：引用 th-config 约定，不在本仓复制配表数值
- 活动 ID、道具 ID 分析用法：在本仓 OKF 建 Dimension / Event 链接
