---
type: Conflict
title: FF area_opr vs 百炼 area_id — 跨项目区服字段名
description: 同名口语「区服」在两项目映射不同字段；禁止跨项目复用过滤器。
tags: [fingertipff, temperedheroes, area_id, area_opr, multi-project]
status: open
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 争议

用户口语 **「区服」「实验服」** 在：

- **百炼（TE 101）**：事件属性 **`area_id`**（int）
- **指尖战纪 FF（TE 249）**：**无 `area_id`**；核心事件区服过滤优先 **`server_id`**；`area_opr` 存在但 TE 显示「行为类型」且未必在核心事件上

# 各方主张

| 来源 | 主张 |
|------|------|
| TE MCP FF | `list_properties` query=area_id → **0 条**；存在 `area_opr` |
| TE MCP 百炼 | `area_id` 为 AB 主过滤 |
| Wiki filter-registry | 各项目独立 slot 绑定 |

# Agent 规则（待业务裁定前）

1. 锁项目后再解析「区服」→ 读对应 filter-registry
2. **禁止**将百炼 AB `area_id` 列表用于 FF
3. FF 区服过滤须用户确认 `area_opr` 或 `server_id` 及取值

# 项目侧记

| 项目 | 生产字段 |
|------|----------|
| temperedheroes | `area_id` → [filter-registry](/projects/temperedheroes/filter-registry.md) |
| fingertipff | `area_opr` / `server_id` → [filter-registry](/projects/fingertipff/filter-registry.md) |

# Citations

[1] TE MCP list_properties projectId=249 vs 101（2026-07-10）
