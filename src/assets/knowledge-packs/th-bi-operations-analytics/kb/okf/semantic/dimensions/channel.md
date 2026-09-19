---
type: Dimension
title: Channel — 渠道
description: 用户获客或登录所归属的渠道标识。
tags: [acquisition, login, slice]
enum_source: 数据中心 CHANNEL 枚举（待对接 project_id）
bi_field: channel_id
owner: 数据组
status: draft
timestamp: 2026-06-17T00:00:00Z
---

# Definition

渠道维度用于按获客/登录渠道拆分 [DAU](/semantic/metrics/dau.md)、[留存](/semantic/metrics/d1_retention.md)、[付费率](/semantic/metrics/pay_rate.md) 等核心指标。

# Mapping

| 层 | 字段 / 来源 |
|----|-------------|
| 埋点 | [LoginEvent.channel](/behavioral/events/properties/channel.md) |
| 数仓 | [dwd 逻辑表](/behavioral/tables/dwd_temperedheroes_event_logical.md) `package` / `platform` |
| 配置 | th-config [渠道与区服维度](https://github.com/internal/th-config) 共识（外链待换） |

# Edge Cases

- **自然量 vs 买量**：渠道枚举变更时须版本化，避免历史报表不可比。
- **多渠道归因**：若使用末次/首次归因，须在 Playbook 中写明（待补）。

# Citations

[1] 与 th-config `info/conventions/渠道与区服维度.md` 对齐（ingest 时补全链接）。
