---
type: Synthesis
title: 百炼英雄 — 数仓逻辑层 ingest 说明
description: 2026-06-18 数仓 ingest 记录：无 raw 物理 Schema，由盘古 MCP t_default + 核心事件编译逻辑层。
tags: [temperedheroes, warehouse, ingest, logical]
project_id: 69
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 背景

用户请求 **ingest 数仓文档**，但 `raw/` 中 **尚无** 物理 Hive/BQ/ClickHouse 表 Schema 文件（`30-data-public-material/common-dictionary/` 等为骨架）。

本次 ingest 采用 **逻辑层编译** 策略：用已有权威源建立最小行为层链路，待物理文档归档后再校准 `resource`。

# 权威来源（本次 ingest）

| 来源 | 用途 |
|------|------|
| 盘古 MCP `list_event_properties` · **t_default** | DWD 表头字段 |
| Wiki Event 页 · t_register / t_login / t_pay_flow | 事件专有字段 |
| [metric-implementation](/projects/temperedheroes/metric-implementation.md) | 聚合口径与 cohort |
| [首充 AB 看板/报告](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md) | ADS 层字段 |

# 产出 Concept

| 类型 | 路径 |
|------|------|
| Data Table ×4 | [tables/](/behavioral/tables/) — dwd · dim · dws · ads |
| Pipeline ×1 | [pip_temperedheroes_te_event_to_dwd](/behavioral/pipelines/pip_temperedheroes_te_event_to_dwd.md) |
| Query Template ×4 | [queries/](/behavioral/queries/) — DAU · D1 · pay_rate · ARPU |

# 双向补链

* Event `lands_in` → dwd（+ dws/ads 视事件）
* Metric `aggregated_from` → dws · dim · dwd
* 全局 Metric 仍为跨项目抽象；百炼生产查数仍以 **TE** 为准

# 限制与后续

| 项 | 状态 |
|----|------|
| `resource: logical://…` | **draft** — 非真实库表 |
| 物理表名 / 分区 / 调度 | **待 raw 归档** |
| RAGFlow 数仓 KB | 当前账号无 dataset 权限，未检索 |

**下一步**：将数仓 Schema 文档放入 `raw/30-data-public-material/common-dictionary/` → 再次 ingest，替换 `resource` 并标 `active`。

# Citations

[1] 盘古 MCP project_id=69（2026-06-18）
[2] [raw-archive-layout §4](../../../info/conventions/raw-archive-layout.md) — common-dictionary → behavioral/events + dimensions
