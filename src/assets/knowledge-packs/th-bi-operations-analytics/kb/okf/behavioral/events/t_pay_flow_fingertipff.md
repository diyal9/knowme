---
type: Tracking Event
title: t_pay_flow — 支付成功（指尖战纪 FF）
description: 指尖战纪 FF 支付成功流水（TE projectId=249）。
event_name: t_pay_flow
project_id: 82
te_project_id: 249
te_event_id: 64841
tags: [core, monetization, fingertipff]
owner: 数据组
status: active
used_by_metrics:
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
timestamp: 2026-07-10T15:30:00Z
---

# 与百炼差异（P0）

| 项 | 百炼 | FF |
|----|------|-----|
| TE eventId | — | **64841** |
| ARPU 金额字段 | **`generalcost`** | **`cost`** |
| `generalcost` | ✅ | ❌ |
| 元口径 | TE 原始单位约定 | 虚拟属性 **`#vp@cost_yuan`** |
| 首充礼包 | `gift_pack_id` 400104–400106 | `trade_id` / `scene_id` 体系 |

对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

# Schema（TE MCP 核验 · 核心字段）

| Property | Type | Description |
|----------|------|-------------|
| `customer_id` | string | 用户 id |
| `order_id` | string | 订单号 |
| `cost` | number | **金额（ARPU 默认分子）** propId 579344 |
| `#vp@cost_yuan` | number | 付费金额（元）· 虚拟属性 |
| `cur_code` | string | 本地币别 |
| `pay_type_id` | number | 支付方式 id |
| `scene_id` | number | 场景 id |
| `trade_id` | number | 商品 ID |
| `product_cnt` | number | 物品数量 |
| `reason` | number | reason |
| `server_id` | number | 服务器 id |
| `platform` | string | 平台(注册时) |
| `os` | string | 操作系统 |
| `package` | number | 渠道包 |
| `adjustid` | string | adjust id |
| `third_order_id` | string | 第三方订单号 |
| `partner` | string | 合作方 |
| `first_pay_time` | datetime | 首次付费时间 |

> **无 `generalcost`、无 `gift_pack_id`（百炼首充 AB 字段）**。

# 生产用法

| 场景 | 规则 |
|------|------|
| 付费率分子 | `t_pay_flow` 去重 `customer_id` |
| ARPU 分子 | **`sum(cost)`**；报「元」时考虑 **`#vp@cost_yuan`** |
| 分母 | 同期 `t_login` user_count |
| 过滤 | [filter-registry](/projects/fingertipff/filter-registry.md) |

# 相关

- [metric-implementation](/projects/fingertipff/metric-implementation.md)
- [百炼 t_pay_flow](/behavioral/events/t_pay_flow.md)（勿混金额字段）
- [PayEvent 模板](/behavioral/events/PayEvent.md)

# Citations

[1] TE MCP `list_properties` projectId=249 eventName=t_pay_flow（2026-07-10）
