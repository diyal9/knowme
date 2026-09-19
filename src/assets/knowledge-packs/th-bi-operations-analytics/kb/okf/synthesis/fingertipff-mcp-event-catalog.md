---
type: Synthesis
title: 指尖战纪 FF — MCP 埋点与 TE 资产目录
description: TE projectId=249 核心事件与属性 lint 快照。
tags: [fingertipff, mcp, te, catalog]
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 项目映射

| 项 | 值 |
|----|-----|
| Wiki slug | `fingertipff` |
| 盘古 `project_id` | **82**（`fingertipfantasy`） |
| TE `projectId` | **249** |
| TE 项目名 | 指尖战纪FF |
| 盘古 `appid` | `bf52717c229ed0d0383c22d4450c4e17` |
| TE `appid` | `c3645f771a0e498f918792905d60b017` |
| TE 事件总数（快照） | **44** |

# 核心事件

| 业务 | TE 事件名 | eventId | 与百炼 |
|------|-----------|---------|--------|
| 注册 | `t_register` | 64146 | 同名 |
| 登录 | `t_login` | 64147 | 同名 |
| 付费 | `t_pay_flow` | 64841 | 同名；金额字段不同 |
| 付费步骤 | `t_pay_step` | 64834 | FF 特有 |

# 关键属性差异（vs 百炼 TE 101）

| 属性 | FF | 百炼 |
|------|-----|------|
| 区服 | **`server_id`**（核心事件）· 无 `area_id` | **`area_id`** |
| `area_opr` | 存在（579396），未必在核心事件 | — |
| 付费金额 | **`cost`** | **`generalcost`** |
| 用户去重 | `customer_id` | `customer_id` |
| 用户 platform | propId 575516 | propId 575530 |
| package 类型 | number | 见百炼 catalog |

# TE 用户标签（节选）

| tagId | displayName | 用途提示 |
|-------|-------------|----------|
| 15041 | 区服关闭注册时间 | 开服分析 |
| 15040 | 区服开服时间 | 开服分析 |
| 15007 | GR2专用：账号注册时间 | cohort 辅助 |
| 14950 | 角色创建时间 | 角色级 cohort |

完整列表：`list_tags` projectId=249。

# Lint 命令（维护者）

1. `list_events` projectId=249 → 与本文 diff
2. `list_properties` 核心字段：`customer_id`, `cost`, `os`, `platform`, `area_opr`, `server_id`
3. 盘古 `list_dimensions`（project_id 确认后）→ 建 [fingertipff-catalog](/references/pango-dimensions/fingertipff-catalog.md)

# Citations

[1] TE MCP（2026-07-10）
