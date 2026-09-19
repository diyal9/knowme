---
type: Reference
title: 百炼英雄 — 首充相关枚举 pin（L2 快照）
description: GIFT_PACK_ID / SCENE_TYPE 首充 AB 用值；MCP 快照 2026-06-18。
tags: [temperedheroes, enum, first-charge, pin]
project_id: 69
enum_names: [GIFT_PACK_ID, SCENE_TYPE]
last_verified: 2026-06-18
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 说明

L2 pin 快照。变更后 `get_dimension_info` 现查；过期见 [pango-dimension-catalog-policy](/synthesis/pango-dimension-catalog-policy.md)。

# SCENE_TYPE

| value | desc | scene_id_cn2 |
|-------|------|--------------|
| **1068** | （中文 desc 见盘古） | **首充礼包** |

# GIFT_PACK_ID（首充三档）

| value | desc |
|-------|------|
| **400104** | 一档首充-6元 |
| **400105** | 二档首充-30元 |
| **400106** | 三档首充-68元 |

# TE / 事件字段

- 付费事件：`t_pay_flow.gift_pack_id`、`t_pay_flow.scene_id`
- 过滤：`gift_pack_id IN (400104,400105,400106)` 或 `scene_id=1068`

# Citations

[1] 盘古 MCP `get_dimension_info` GIFT_PACK_ID、SCENE_TYPE project_id=69（2026-06-18）
