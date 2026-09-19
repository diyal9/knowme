---
type: Reference
title: 指尖战纪 FF — 盘古埋点枚举大类目录（L1）
description: 盘古 project_id=82；L1 目录待 list_dimensions scope 开通后 refresh。
tags: [fingertipff, pango, dimension, catalog]
project_id: 82
te_project_id: 249
status: draft
owner: 数据组
timestamp: 2026-07-10T15:15:00Z
---

# 项目映射

| 项 | 值 |
|----|-----|
| 盘古 MCP `project_id` | **82** |
| `name` | `fingertipfantasy` |
| `describe` | 指尖战纪 |
| TE `projectId` | **249**（指尖战纪FF） |

# 状态

| 项 | 状态 |
|----|------|
| 项目 ID（`list_projects`） | ✅ **82** |
| `get_project_detail` | ✅ 可读 |
| `list_dimensions` | ⚠️ 当前账号 **越权** — L1 目录未 ingest |

# 下一步

1. 开通盘古数据中心 MCP scope（`project_id=82`）
2. `list_dimensions(project_id=82)` → 追加大类表
3. 将本页 `status` 升 **active**

维护策略：[pango-dimension-catalog-policy](/synthesis/pango-dimension-catalog-policy.md)

# Citations

[1] 盘古 MCP `list_projects` / `get_project_detail` project_id=82（2026-07-10）
