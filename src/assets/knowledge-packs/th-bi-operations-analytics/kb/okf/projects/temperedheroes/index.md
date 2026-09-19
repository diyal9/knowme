---
type: Reference
title: 百炼英雄（temperedheroes）— 项目域
description: TH国服《百炼英雄》数据分析项目分域入口。
project_id: 69
pango_project_name: temperedheroes
te_project_id: 101
tags: [project, temperedheroes, cn]
owner: 数据组
status: active
timestamp: 2026-06-18T00:00:00Z
---

# Overview

| 项 | 值 |
|----|-----|
| 盘古 `project_id` | **69** |
| 英文名 | `temperedheroes` |
| 发行区域 | 国服（`issuing_region=1`） |
| TE `projectId` | **101**（TH国服-百炼英雄；≠ 盘古 69） |
| TE 看板 | [首充AB 101_12111](/#/panel/panel/101_12111) |

# 分析入口（查数前必读）

| 优先级 | 文档 | 用途 |
|--------|------|------|
| **P0** | [Filter Slot 注册表](/projects/temperedheroes/filter-registry.md) | 「平台/渠道/区服」澄清与 TE 过滤器 |
| **P0** | [生产指标实现](/projects/temperedheroes/metric-implementation.md) | TE 可执行口径 |
| **P0** | [FF vs 百炼字段对照](/synthesis/ff-vs-temperedheroes-field-diff.md) | 跨项目 canonical |
| **P0** | [分析门禁（防乱报）](/synthesis/temperedheroes-analytics-guardrails.md) | Agent 红线 |
| **P0** | [KB 健康分看板](/synthesis/temperedheroes-kb-health-scorecard.md) | 冲刺期间每日体检 |
| **P1** | [就绪度清单](/projects/temperedheroes/analytics-readiness.md) | 还缺什么 / 待确认 |

# 活跃分析

| Concept | 说明 |
|---------|------|
| [MCP 埋点与 TE 资产目录](/synthesis/temperedheroes-mcp-event-catalog.md) | 盘古 139 元事件 + TE 145 事件 lint · 看板/标签 |
| [盘古枚举大类目录（67）](/references/pango-dimensions/temperedheroes-catalog.md) | L1 索引；首充 pin [enums](/references/pango-dimensions/temperedheroes-first-charge-enums.md) |
| [首充档位解锁 AB Playbook](/semantic/playbooks/first-charge-tier-ab-test.md) | 看板 + 阶段性报告 SOP |
| [AB 看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md) | TE 报表 87751–87758 |
| [多项目报表导出](/synthesis/multi-project-report-export-guide.md) | 与 FF 并存时 CSV 隔离 |
| [阶段性报告（第 1 期）](/synthesis/temperedheroes-first-charge-ab-report-phase1.md) | 有效窗 5/27~5/31 · TE 已跑数 |
| [阶段性报告模板（空白）](/synthesis/temperedheroes-first-charge-ab-report-phase1-template.md) | 第 2 期起复用 |
| [数仓逻辑层](/synthesis/temperedheroes-warehouse-logical-ingest.md) | tables/queries/pipeline · 物理表待 raw |

# Citations

[1] 用户陈述 + 盘古 `list_user_projects`（2026-06-17）
[2] MCP 全量梳理 + 就绪度（2026-06-18）
