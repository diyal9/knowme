---
type: Dimension
title: Platform — 平台
description: 客户端运行平台，如 iOS、Android、HarmonyOS。
tags: [client, slice]
enum_source: 数据中心 PLATFORM 枚举（待对接）
bi_field: platform
owner: 数据组
status: draft
timestamp: 2026-06-17T00:00:00Z
---

# Definition

平台维度用于区分移动端 OS / 客户端类型，是核心报表的默认切片之一。

# Mapping

| 层 | 字段 / 来源 |
|----|-------------|
| 埋点 | [LoginEvent.platform](/behavioral/events/properties/platform.md) |
| 数仓 | 事件表 `platform` 或 [dwd 逻辑表](/behavioral/tables/dwd_temperedheroes_event_logical.md) · dim 待物理校准 |

# Edge Cases

- **模拟器 / PC 包**：是否单独枚举或归入 Other。
- **双端账号**：同一 user_id 跨平台登录时的去重规则与 DAU 一致。

# Citations

[1] 初始化模板；枚举值以数据中心 MCP `list_dimensions` 为准。
