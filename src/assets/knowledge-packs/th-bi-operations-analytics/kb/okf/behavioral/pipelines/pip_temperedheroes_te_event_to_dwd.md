---
type: Pipeline
title: pip_temperedheroes_te_event_to_dwd — 百炼 TE 事件 → DWD 逻辑层
description: 埋点采集经 TE 入库至 DWD 事件明细逻辑层的链路说明（物理 ETL 待 raw 校准）。
project_id: 69
te_project_id: 101
tags: [temperedheroes, pipeline, etl, te]
owner: 数据组
status: draft
timestamp: 2026-06-18T00:00:00Z
---

# Overview

```
客户端 SDK 上报
  → 盘古埋点协议（t_default 表头 + 事件专有字段）
  → TE 采集 / 清洗（projectId=101）
  → [dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)
  → [dws_temperedheroes_user_daily_logical](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)
  → [ads_temperedheroes_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md)
```

> **物理库表名未知**：`resource` 均为 `logical://` 占位；raw 数仓文档归档后须替换为真实 `project.dataset.table`。

# 核心事件落库

| 事件 | 逻辑 DWD 分区键 | 下游 |
|------|----------------|------|
| `t_register` | `event_name='t_register'` | dim cohort · 留存初始 |
| `t_login` | `event_name='t_login'` | DAU · 留存回访 |
| `t_pay_flow` | `event_name='t_pay_flow'` | 付费率 · ARPU · 首充 AB |

# 表头继承

全部核心事件继承盘古 [t_default 表头](/behavioral/tables/dwd_temperedheroes_event_logical.md#t_default-表头-mcp-2026-06-18)（`customer_id`、`area_id`、`ftime`、`platform` 等）。

# 查数路由

| 场景 | 推荐 |
|------|------|
| 即席 / 看板 | **TE MCP**（见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)） |
| 数仓 SQL | 本 Pipeline 逻辑表 + [queries/](/behavioral/queries/) 模板 |

# Citations

[1] 盘古 MCP `list_events` + `list_event_properties` project_id=69（2026-06-18）
[2] [百炼 MCP 事件目录](/synthesis/temperedheroes-mcp-event-catalog.md)
