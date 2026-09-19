---
type: Synthesis
title: 盘古埋点枚举 — 目录维护与更新策略
description: 67 大类目录 vs 枚举值的 Wiki 边界；MCP 变更后如何 refresh / lint。
tags: [pango, dimension, enum, policy, lint]
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 问题

盘古数据中心枚举会**持续新增/修改**（新活动、新礼包、新场景）。若把 67 大类 × 全部 key/value 行都固化进 Wiki，很快 stale，且 diff 噪声大。

# 两层模型（推荐）

| 层 | Wiki 存什么 | 权威来源 | 更新频率 |
|----|------------|----------|----------|
| **L1 大类目录** | 枚举大类名、描述、关联字段 `relation_name`、盘古 id | `list_dimensions` | **定期 lint / 按需 refresh** |
| **L2 枚举值** | **默认不固化**；Playbook 引用的关键值可 **pin 快照** | `get_dimension_info` | **分析时现查** 或 pin 页 `last_verified` 过期后 refresh |

```
分析时问「GIFT_PACK_ID 400104 是什么」
  → 优先 get_dimension_info(name=GIFT_PACK_ID) 现查
  → 若 Playbook / Event 页有 pin 快照且 last_verified 较新，可先用 Wiki，但与 MCP 不一致则并列

维护时问「枚举有没有变」
  → list_dimensions 拉全量 → 与 [temperedheroes-catalog](/references/pango-dimensions/temperedheroes-catalog.md) diff
  → 写 log.md；新增大类 append，删除/改名标 deprecated 或 Conflict
```

# 何时刷新 L1 目录

1. 用户说 **「刷新枚举目录」「ingest dimensions」「lint 枚举」**
2. 数据中心 **新增/审批通过** 枚举大类（`add_dimension` 等 MCP 写操作后）
3. 版本上线后 Playbook 引用新 `dim` 字段，发现 catalog 无对应大类
4. **季度例行** lint（可与事件 catalog lint 合并）

# 何时刷新 L2 枚举值（pin 页）

仅对 **Playbook / AB 实验 / 核心 Metric** 直接引用的 enum 大类建 pin 页或 Event 内表格，例如：

- `GIFT_PACK_ID`（首充 AB）
- `SCENE_TYPE`（付费场景 1068）

pin 页 frontmatter 建议：

```yaml
enum_source: GIFT_PACK_ID
last_verified: 2026-06-18
status: active  # 过期可标 stale，禁止作唯一依据
```

`last_verified` 超过 **90 天** 或 lint 发现 MCP diff → Agent 提示 refresh，**不静默假设仍有效**。

# 变更类型处理

| MCP 变更 | Wiki 动作 |
|----------|-----------|
| 新增大类 | catalog 表追加一行 + `log.md` |
| 大类 desc / relation_name 变更 | 更新 catalog 对应行 |
| 大类删除或下线 | catalog 行标 `deprecated`；引用的 Event/Playbook 加 Note |
| 新增枚举 **值**（同 value 新 desc） | **不必**改 catalog；Playbook 若引用该 value，refresh pin 或现查 MCP |
| 枚举 value **改名/删值** | 若 Wiki pin 了旧 value → 建 open [Conflict](/synthesis/conflicts/) |
| 配置中心枚举变更 | **无关** — 见 th-config / `query_enum_config`，勿与数据中心枚举混用 |

# Agent 命令对照

| 用户意图 | 动作 |
|----------|------|
| 有哪些枚举大类 | 读 catalog；必要时 MCP `list_dimensions` 校验 |
| XX 枚举有哪些值 | MCP `get_dimension_info(name=XX)` **现查** |
| 枚举更新了怎么办 | 本策略 L1 refresh + 相关 pin 页 L2 refresh |
| 和配置中心道具 ID 对不上 | 并列说明数据中心枚举 ≠ 配置中心枚举 |

# 与权威优先级

见 [authority-and-conflicts.md](../../../info/conventions/authority-and-conflicts.md)：**盘古 MCP 枚举 > Wiki 快照**。open Conflict 不得作唯一口径依据。

# Citations

[1] 盘古 MCP `list_dimensions` / `get_dimension_info`（2026-06-18）
[2] 百炼 catalog：[temperedheroes-catalog](/references/pango-dimensions/temperedheroes-catalog.md)
