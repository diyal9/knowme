---
type: Synthesis
title: 百炼英雄 — 分析门禁（防乱报）
description: Agent / 数据组在百炼（project_id=69）作答与出数时必须遵守的红线。
tags: [temperedheroes, guardrails, accuracy, policy]
project_id: 69
te_project_id: 101
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 原则

**宁可说「查不到 / 待确认」，不可把猜测、模板或他项目口径当百炼事实。**

# 作答前必确认

| # | 项 | 未确认时 |
|---|-----|----------|
| 1 | 项目 = 百炼（盘古 **69** / TE **101**） | 禁止给百炼具体数字 |
| 2 | **时间范围**（TE event/retention/funnel 禁止默认近 7 天） | 禁止 `query_adhoc` |
| 3 | 指标定义来自 [metric-implementation](/projects/temperedheroes/metric-implementation.md) | 禁止自创 cohort / 事件名 |
| 4 | 过滤器来自 [filter-registry](/projects/temperedheroes/filter-registry.md) | 「平台」须 Slot 消歧 |
| 5 | 事件名 = **`t_register` / `t_login` / `t_pay_flow`**（非 LoginEvent 模板） | 禁止用模板名跑 TE |
| 6 | AB 分析过滤器见 [readiness § AB](/projects/temperedheroes/analytics-readiness.md) | 禁止加未文档化的 filter |

# 禁止行为

1. **禁止**用 `LoginEvent` / `PayEvent` 模板名在 TE 查百炼数据
2. **禁止**假设盘古 project_id = TE projectId（百炼为 69 ≠ 101）
3. **禁止**在 open [Conflict](/synthesis/conflicts/) 未裁定时，将行业手册或 Wiki 模板当百炼唯一口径
4. **禁止**在 `generalcost` 单位未确认时，向业务报「元」级金额（须声明 TE 原始单位）
5. **禁止**对 R4/R6（档位解锁 / 提前解锁）报自动统计值 — **无专用埋点**
6. **禁止**对 R8 整体付费率/ARPU 在未跑 TE 或未读报告前编造数值
7. **禁止**在样本不均衡（如 ±20%）时给出「显著优于对照」类强结论
8. **禁止**用用户属性 `platform=temperedheroes_cn` 单独过滤 AB 窗（见 [platform 冲突](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)）— 当前以 **`area_id` 区服列表** 为准

# 允许 / 推荐

| 场景 | 做法 |
|------|------|
| 查定义 | [metric-implementation](/projects/temperedheroes/metric-implementation.md) + MCP 现查 enum |
| 查数字 | TE `build_*_analysis_qp` → `status=generated` → `query_adhoc`；附 QP 摘要 |
| 查协议 | 盘古 MCP `list_event_properties` / `get_dimension_info` |
| 已有看板 | `query_report_data` / 读 [第 1 期报告](/synthesis/temperedheroes-first-charge-ab-report-phase1.md) |
| draft 页 | 必须声明「当前为 draft / 待 MCP 核验」 |

# 输出格式（带数答案）

每条数值须附带：

1. **TE projectId** + **时间窗**
2. **事件 / 属性 / 过滤器**（与 metric-implementation 一致）
3. **数据源**：`query_adhoc` / 报表 ID / 报告期号
4. **限制说明**（样本不均衡、cohort 未成熟、缺埋点等）

# Citations

[1] [te-analysis-policy](/synthesis/te-analysis-policy.md)
[2] [authority-and-conflicts.md](../../../info/conventions/authority-and-conflicts.md)
