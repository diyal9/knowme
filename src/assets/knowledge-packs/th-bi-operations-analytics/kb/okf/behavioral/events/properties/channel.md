---
type: Event Property
title: channel（事件属性）
description: 渠道 ID，映射到 [Channel 维度](/semantic/dimensions/channel.md)。
tags: [property, channel]
data_type: string
owner: 数据组
status: draft
timestamp: 2026-06-17T00:00:00Z
---

# Definition

出现在 [LoginEvent](/behavioral/events/LoginEvent.md)、[PayEvent](/behavioral/events/PayEvent.md) 等事件中，标识用户所属渠道。

# Enum

以数据中心 **CHANNEL** 枚举为准；与 th-config 渠道配置保持一致。

# Examples

_待 ingest：从 `list_dimensions` / th-config 同步。_
