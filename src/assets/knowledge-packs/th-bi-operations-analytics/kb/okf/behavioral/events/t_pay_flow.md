---
type: Tracking Event
title: t_pay_flow — 支付成功
description: 百炼英雄支付成功流水（盘古数据中心）。
event_name: t_pay_flow
project_id: 69
tags: [core, monetization, temperedheroes]
owner: 数据组
status: active
properties:
  - /behavioral/events/properties/platform.md
lands_in:
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md
used_by_metrics:
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
timestamp: 2026-06-18T00:00:00Z
---

# Schema（百炼英雄 · 盘古 MCP 核验）

继承 `t_default` 表头，以下为 **t_pay_flow 专有字段**：

| Property | Type | Enum | Required | Description |
|----------|------|------|----------|-------------|
| `order_id` | string | — | ✓ | 订单号 |
| `pay_type_id` | dim | PAY_TYPE | ✓ | 支付方式 |
| `partner` | string | — | | 合作方 |
| `scene_id` | dim | SCENE_TYPE | ✓ | 场景 id（首充 **1068**） |
| `product_id` | dim | PRODUCT_TYPE | ✓ | 物品种类 |
| `product_cnt` | int | — | ✓ | 物品数量 |
| `cur_code` | string | — | ✓ | 本地币别 |
| `cost` | int | — | ✓ | 本地金额 |
| `generalcost` | int | — | ✓ | **通用货币金额（ARPU 分子推荐）** |
| `adjustid` | string | — | | adjust id（归因） |
| `reason` | dim | REASON_TYPE | ✓ | 原因 |
| `gift_pack_id` | dim | GIFT_PACK_ID | | 礼包 id |
| `gift_pack_cnt` | int | — | | 礼包数量 |
| `vip_lvl` | int | — | | 当前 vip 等级 |
| `team_lvl` | int | — | | 当前佣兵团等级 |
| `third_order_id` | string | — | | 第三方订单号 |
| `open_id` | string | — | | openid |
| `sdk_order_id` | string | — | | SDK 订单号 |
| `conf_info` | object | — | | 配置信息 |

# 首充档位礼包 ID（GIFT_PACK_ID · pin 快照）

> `last_verified: 2026-06-17` — 值以 MCP `get_dimension_info(GIFT_PACK_ID)` 为准；过期请 [refresh](/synthesis/pango-dimension-catalog-policy.md)

| 档位 | gift_pack_id | 说明 |
|------|--------------|------|
| 1 档 | **400104** | 一档首充-6元 |
| 2 档 | **400105** | 二档首充-30元 |
| 3 档 | **400106** | 三档首充-68元 |

首充场景 `scene_id=1068`（三挡首充 / 首充礼包）。

# Citations

[1] 盘古 MCP `list_event_properties` project_id=69 event_id=586450443039670304（2026-06-18）
[2] 盘古 MCP `get_dimension_info` GIFT_PACK_ID、SCENE_TYPE（2026-06-17）
