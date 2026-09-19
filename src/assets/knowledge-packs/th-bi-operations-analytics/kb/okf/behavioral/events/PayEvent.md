---
type: Tracking Event
title: PayEvent
description: 用户完成付费（订单成功）时上报的元事件。
event_name: PayEvent
tags: [core, monetization, iap]
owner: 数据组
status: draft
properties:
  - /behavioral/events/properties/platform.md
  - /behavioral/events/properties/channel.md
lands_in:
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md
used_by_metrics:
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
timestamp: 2026-06-17T00:00:00Z
---

# Schema

| Property | Type | Description |
|----------|------|-------------|
| `user_id` | string | 付费用户 |
| `order_id` | string | 订单号 |
| `amount` | number | 付费金额（币种与单位须统一） |
| `currency` | string | 币种 |
| `product_id` | string | 商品 ID |
| `platform` | string | 见 [platform](/behavioral/events/properties/platform.md) |
| `channel` | string | 见 [channel](/behavioral/events/properties/channel.md) |
| `event_time` | timestamp | 付费时间 |

# Project Mapping

| 项目 | 生产事件名 | Wiki |
|------|-----------|------|
| 百炼英雄（project_id=69） | **`t_pay_flow`** | [t_pay_flow](/behavioral/events/t_pay_flow.md) |
| 指尖战纪 FF（盘古 82 / TE 249） | **`t_pay_flow`** | [t_pay_flow_fingertipff](/behavioral/events/t_pay_flow_fingertipff.md) · 金额 **`cost`** |

# Notes

- [ARPU](/semantic/metrics/arpu.md)、LTV 等 Metric 链接本事件；退款/补单是否另报事件须与财务对齐。
- 百炼英雄付费金额字段：`generalcost`（通用货币）优先于 `cost`（本地）。
- 指尖战纪 FF 付费金额字段：**`cost`**（无 `generalcost`）。

# Citations

[1] 初始化模板；待 MCP 拉取正式协议后修订。
