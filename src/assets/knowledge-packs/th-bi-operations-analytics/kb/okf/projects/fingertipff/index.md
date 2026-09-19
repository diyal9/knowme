---
type: Reference
title: 指尖战纪 FF（fingertipff）— 项目域
description: 《指尖战纪 FF》数据分析项目分域入口。
project_id: 82
pango_project_name: fingertipfantasy
te_project_id: 249
tags: [project, fingertipff, cn]
owner: 数据组
status: active
timestamp: 2026-07-10T15:15:00Z
---

# Overview

| 项 | 值 |
|----|-----|
| Wiki slug | **`fingertipff`** |
| 中文名 | 指尖战纪 FF（TE）/ 指尖战纪（盘古） |
| 盘古 `project_id` | **82**（`name=fingertipfantasy`，`describe=指尖战纪`） |
| 盘古门户 `pango_project_id` | 83 |
| 盘古 `appid` | `bf52717c229ed0d0383c22d4450c4e17` |
| TE `projectId` | **249**（指尖战纪FF；**≠** 盘古 82） |
| TE `appid` | `c3645f771a0e498f918792905d60b017` |
| 发行区域 | 国服（`issuing_region=1`） |
| 时区 | TE 配置 `defaultTimeZoneOffset=0` → 业务日切须澄清（见 [readiness](/projects/fingertipff/analytics-readiness.md)） |

> **双 ID + 双 appid**：查埋点/枚举用盘古 **82**；TE 跑数用 **249**。`appid` 亦不一致，勿混用。

# 分析入口（查数前必读）

| 优先级 | 文档 | 用途 |
|--------|------|------|
| **P0** | [Filter Slot 注册表](/projects/fingertipff/filter-registry.md) | 「平台/渠道/区服」澄清；**勿用百炼 `area_id`** |
| **P0** | [生产指标实现](/projects/fingertipff/metric-implementation.md) | TE 可执行口径 |
| **P0** | [FF vs 百炼字段对照](/synthesis/ff-vs-temperedheroes-field-diff.md) | 跨项目 canonical |
| **P0** | [分析门禁](/synthesis/fingertipff-analytics-guardrails.md) | Agent 红线 |
| **P1** | [就绪度清单](/projects/fingertipff/analytics-readiness.md) | P0 阻塞与待确认项 |
| **P1** | [MCP 埋点与 TE 资产目录](/synthesis/fingertipff-mcp-event-catalog.md) | 事件/属性 lint |
| **P1** | [核心 TE 报表目录](/synthesis/fingertipff-core-reports-catalog.md) | 留存/活跃/付费报表 pin |
| **P1** | [多项目报表导出](/synthesis/multi-project-report-export-guide.md) | CSV 导出隔离 |

# 与百炼（TH）并存

同一会话可交替查 **百炼** 与 **FF**，但必须：

1. 每轮 L0 漂移检测 → 换项目时 **F-4 重选**
2. 重读本项目 `filter-registry` + `metric-implementation`（过滤器 **不可跨项目沿用**）
3. 口语「指尖战纪」「FF」「指尖」→ 默认 `fingertipff`；「百炼」「TH」→ `temperedheroes`

全仓多项目 SOP：[multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)

# Citations

[1] 盘古 MCP `list_projects` / `get_project_detail` project_id=82（2026-07-10）
[2] TE MCP `list_projects` projectId=249（2026-07-10）
