---
type: Event Property
title: platform（事件属性）
description: 客户端平台，映射到 [Platform 维度](/semantic/dimensions/platform.md)。
tags: [property, platform]
data_type: string
owner: 数据组
status: draft
timestamp: 2026-06-17T00:00:00Z
---

# Definition

出现在 [LoginEvent](/behavioral/events/LoginEvent.md)、[PayEvent](/behavioral/events/PayEvent.md) 等核心事件中，用于平台切片。

**多项目**：业务「平台/渠道」可能不是本属性 → 见各项目 [filter-registry](/projects/temperedheroes/filter-registry.md)（百炼样板）。

# Enum

以数据中心 **PLATFORM** 枚举为准（ingest 时从 MCP 同步取值表）。

# Examples

| value | 含义 |
|-------|------|
| `ios` | iOS |
| `android` | Android |

_以上为示例，非权威枚举。_
