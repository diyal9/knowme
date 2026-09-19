---
type: Synthesis
title: 多项目并存操作指南（TH + FF）
description: 百炼与指尖战纪 FF 同仓使用时的隔离、澄清流程与 P0/P1/P2 坑位清单。
tags: [multi-project, temperedheroes, fingertipff, policy, guardrails]
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 适用范围

本仓已接入：

| slug | 中文名 | 盘古 ID | TE ID |
|------|--------|---------|-------|
| [temperedheroes](/projects/temperedheroes/) | 百炼英雄 | **69** | **101** |
| [fingertipff](/projects/fingertipff/) | 指尖战纪 FF | **82** | **249** |

策略全文：[multi-project-filter-clarification-policy](/synthesis/multi-project-filter-clarification-policy.md)

**Canonical 对照**：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md) · **报表导出**：[multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md)

# 标准查数流程（每轮）

```
用户输入
  → L0 漂移检测（项目信号 vs Session）
  → 锁定 project_slug → 读 index + filter-registry + metric-implementation
  → L1 时间 + 指标
  → L2 平台/渠道/区服 Slot 消歧（F-2）
  → F-3 复述确认 → confirmed_by_user=true
  → L3 TE builder → query_adhoc
```

换项目触发词：「换成 FF」「查百炼」「指尖战纪」「还是上一个项目」等 → 见 [first-turn-templates F-4](../../../.cursor/skills/th-bi-analytics-assistant/references/first-turn-templates.md)。

# P0 坑位 — 已文档化门禁

| # | 风险 | 处置 |
|---|------|------|
| P0-1 | Session 静默沿用错误项目 | L0 漂移 → F-4；`confirmed_by_user=false` 禁止 TE |
| P0-2 | 盘古 ID ≠ TE ID | 查数只用 **TE projectId**；映射见各项目 index |
| P0-3 | 模板事件名 `LoginEvent` | 生产名 **`t_login`**（两项目同名，但仍须锁项目） |
| P0-4 | 「平台」歧义 | 按项目 filter-registry 做 F-2；未选禁止 TE |
| P0-5 | **百炼 `area_id` 套 FF** | FF 用 **`area_opr`/`server_id`** → [Conflict](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md) |
| P0-6 | **百炼 `generalcost` 套 FF** | FF 用 **`cost`**；单位未确认不报「元」 |
| P0-7 | 无 Wiki 口径却报项目数字 | 读 metric-implementation + guardrails |
| P0-8 | MCP 越权 | 盘古 **82** 元信息可读；`list_events`/`list_dimensions` 待 scope |

# P1 坑位 — 口径偏差

| # | 风险 | 处置 |
|---|------|------|
| P1-1 | Cohort 定义不一致 | 两项目均 `t_register`→`t_login`；行业词见 open Conflict |
| P1-2 | FF 时区 offset=0 | 查数前确认业务日；见 FF readiness |
| P1-3 | 角色 vs 账号主体 | FF 标签含角色/账号维度；Playbook 须声明 |
| P1-4 | platform 枚举跨项目复制 | 百炼 `temperedheroes_cn` **不得**用于 FF |
| P1-5 | filters[] 跨项目残留 | 漂移后 `filters_stale` 或清空 |

# P2 坑位 — 维护

| # | 风险 | 处置 |
|---|------|------|
| P2-1 | 全局 Metric 当生产口径 | 以 `projects/<slug>/metric-implementation` 为准 |
| P2-2 | 枚举 catalog stale | [pango-dimension-catalog-policy](/synthesis/pango-dimension-catalog-policy.md) |
| P2-3 | Agent memory 跨项目污染 | episode `meta.project_slug`；见 memory episode-schema |
| P2-4 | 仅 TH 有 AB Playbook | FF AB 须新建 Playbook + filter 规则 |

# 项目切换速查

| 用户口语 | slug | TE |
|----------|------|-----|
| 百炼、TH、百炼英雄 | temperedheroes | 101 |
| 指尖战纪、FF、指尖 | fingertipff | 249 |

# Agent 记忆

跨项目指正/习惯写入 episode 时建议：

```json
"meta": { "project_slug": "fingertipff", "te_project_id": 249 }
```

# Citations

[1] [multi-project-filter-clarification-policy](/synthesis/multi-project-filter-clarification-policy.md)
[2] [temperedheroes guardrails](/synthesis/temperedheroes-analytics-guardrails.md) · [fingertipff guardrails](/synthesis/fingertipff-analytics-guardrails.md)
