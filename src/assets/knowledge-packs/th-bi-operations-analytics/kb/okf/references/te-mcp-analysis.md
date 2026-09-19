---
type: Reference
title: TE 分析 MCP（查数执行轨）
description: user-te-mcp-analysis 与 OKF 语义层的分工、Guided 流程与 Metric 映射。
tags: [te-mcp, analysis, query]
status: active
owner: 数据组
mcp_server: user-te-mcp-analysis
timestamp: 2026-06-17T16:00:00Z
---

# Overview

**TE 分析 MCP** 负责「业务词 → 查询 QP → 跑数」；**不**替代盘古埋点权威或 Wiki 口径定义。

技能包全文：`.cursor/skills/th-bi-analytics-assistant/references/te-mcp-analysis-integration.md`

权威层级：[te-analysis-policy](/synthesis/te-analysis-policy.md)

# 三轨

| 轨 | 来源 | 回答什么问题 |
|----|------|--------------|
| 协议 | 盘古 MCP | 事件/属性/枚举叫什么 |
| 语义 | OKF Wiki | 指标**应如何定义** |
| 执行 | TE MCP | 平台上**实际查出多少** |

# Guided 流程（摘要）

```
用户意图 + TE projectId + 时间范围
    → build_*_analysis_qp（业务词，内部解析元数据）
    → status=generated ? query_adhoc : 向用户澄清
    → 可选 drilldown_users
```

**禁止**：guided 失败后用 `list_events` 凑 QP。

# Metric → TE 映射

> **查数路由**：已知项目时先读 [projects/](/projects/) → `metric-implementation`；下表为 **跨项目生产事件名对照**；**过滤器与金额字段须读各项目 registry / implementation**。

| Wiki Metric | Builder | modelType | temperedheroes (101) | fingertipff (249) | 模板（禁止 TE 直用） |
|-------------|---------|-----------|------------------------|---------------------|----------------------|
| [dau](/semantic/metrics/dau.md) | `build_event_analysis_qp` | `event` | `t_login` · `user_count` | `t_login` · `user_count` | LoginEvent |
| [d1_retention](/semantic/metrics/d1_retention.md) | `build_retention_analysis_qp` | `retention` | `t_register`→`t_login` · 1 | 同左 | LoginEvent |
| [d7_retention](/semantic/metrics/d7_retention.md) | `build_retention_analysis_qp` | `retention` | `t_register`→`t_login` · 7 | 同左 | LoginEvent |
| [pay_rate](/semantic/metrics/pay_rate.md) | `build_event_analysis_qp` | `event` | `t_pay_flow`/`t_login` | 同左 | PayEvent |
| [arpu](/semantic/metrics/arpu.md) | `build_event_analysis_qp` | `event` | `sum(generalcost)`/login | **`sum(cost)`**/login | PayEvent |

完整口径：

- 百炼：[metric-implementation](/projects/temperedheroes/metric-implementation.md) · TE **101** · [guardrails](/synthesis/temperedheroes-analytics-guardrails.md)
- FF：[metric-implementation](/projects/fingertipff/metric-implementation.md) · TE **249** · [guardrails](/synthesis/fingertipff-analytics-guardrails.md)

多项目 SOP：[multi-project-operating-guide](/synthesis/multi-project-operating-guide.md) · 字段对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

事件名占位 `<登录事件名>` / `<付费事件名>` 须按项目 TE 元数据填写；lint 时对照 Wiki Event 页与 MCP `list_events`。

# 项目 ID

- TE：`list_projects` → `projectId`（integer）
- 盘古：`list_user_projects` → `project_id`
- 映射：[projects/](/projects/)

| slug | 盘古 | TE |
|------|------|-----|
| temperedheroes | **69** | **101** |
| fingertipff | **82** | **249** |

# Citations

[1] MCP 工具目录：Cursor `mcps/user-te-mcp-analysis/tools/`
[2] 技能集成：`.cursor/skills/th-bi-analytics-assistant/references/te-mcp-analysis-integration.md`
