---
type: Playbook
title: 首充档位解锁 AB 实验 — 分析 SOP
description: TH国服百炼英雄 · 微小渠道 · 按区服分流的首充档位解锁 AB 实验看板与阶段性报告流程。
tags: [ab-test, first-charge, monetization, temperedheroes]
project_id: 69
owner: 数据组
status: draft
related_segments:
  - /semantic/segments/ab-firstcharge-test.md
  - /semantic/segments/ab-firstcharge-control.md
related_metrics:
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
timestamp: 2026-06-17T00:00:00Z
---

# 实验设计（用户确认版）

## 背景

在 **TH国服-百炼英雄** 微小渠道（用户属性 `platform=temperedheroes_cn`）进行首充档位解锁机制 AB 实验。

## 分组

| 组别 | 机制 | 区服 ID |
|------|------|---------|
| **对照组** | 达到天数 → 解锁下一档 | 9994、9996、9998、10000、10002、10004、10006、10008、10010 |
| **实验组** | 对照组机制 + **购买前置档位 → 解锁后面档位** | 9993、9995、9997、9999、10001、10003、10005、10007、10009 |

分流维度为 **区服**（非用户级随机），分析时必须按区服聚合为 AB 两组。

## 推荐分析 Cohort

**默认**：实验开始后、在实验/对照区服 **新注册** 的用户（`RegisterEvent` 或 TE 等价事件，注册日 ≥ 实验开始日）。

备选（须单独声明）：实验服全部活跃用户（含存量，解释成本高）。

## 全局过滤

- `platform = temperedheroes_cn`（用户属性，待 TE 字段名 MCP 核验）
- 区服 ∈ 上表实验/对照列表

# 执行步骤

## Step 0 — 权限与 ID 对齐

1. TE `list_projects` → 取得百炼英雄 `projectId`（**≠** 盘古 69，须映射）
2. 盘古 `list_events` / `list_event_properties` → 核验首充相关事件名与区服字段
3. 记录于 [项目 index](/projects/temperedheroes/index.md)

## Step 1 — 创建 AB 用户标签（TE）

见 [实验组 Segment](/semantic/segments/ab-firstcharge-test.md) 与 [对照组 Segment](/semantic/segments/ab-firstcharge-control.md)。

标签类型：`condition`；按 **用户属性 platform + 区服 ID** 划分。

## Step 2 — 搭建看板

按 [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md) 在 TE 创建 8～10 张报表并组装看板：

1. 样本均衡（新进 / DAU）
2. 首充转化率 + 首充流水
3. 档位解锁 / 购买漏斗（分档）
4. 提前解锁占比（实验组，需解锁原因字段）
5. D1 / D7 留存护栏
6. 整体 ARPU / 付费率

## Step 3 — 阶段性报告

- **节奏**：建议自然周（周一出上周数据）
- **模板**：[phase1 模板](/synthesis/temperedheroes-first-charge-ab-report-phase1-template.md)
- **显著性**：样本不足时仅报方向性 + lift%，不做过早显著性结论

## Step 4 — Lint（可选）

- TE 事件名 vs Wiki `behavioral/events/` diff
- 盘古 MCP vs TE 枚举 diff → 有差异写 [Conflicts](/synthesis/conflicts/)

# 核心指标口径

| 指标 | 定义 | 备注 |
|------|------|------|
| 新用户首充转化率 | 同期新注册用户中发生首次付费的用户占比 | 见 [行业首充转化率](/references/industry-glossary/monetization.md) |
| 档位 N 解锁率 | 新用户中触发第 N 档解锁的用户占比 | 需档位解锁事件 + 档位序号属性 |
| 档位 N 购买率 | 新用户中购买第 N 档礼包的用户占比 | PayEvent + product_id / 档位 ID |
| 提前解锁占比 | 实验组：解锁原因=购买前置档 / 全部解锁 | **依赖埋点「解锁原因」字段** |
| 首充相关 ARPU | 首充礼包流水 / 新用户数 | 商品范围须与策划对齐 |
| D1 / D7 留存 | 注册 cohort 留存 | 见 [d1](/semantic/metrics/d1_retention.md)、[d7](/semantic/metrics/d7_retention.md) |

# 待用户 / 数据组补全（open）

| 项 | 状态 |
|----|------|
| 实验开始日 | **2026-05-20** |
| 实验结束日（本期） | **2026-05-26** |
| 首充档位 | 400104/105/106；scene **1068**（[pin](/references/pango-dimensions/temperedheroes-first-charge-enums.md)） |
| 埋点事件 | **t_register**(39612) / **t_login**(39613) / **t_pay_flow** |
| 区服字段 | **area_id** |
| TE projectId | **101** |
| platform 用户属性 | TE propId **575530**；AB 窗过滤见 [Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md) |
| 解锁原因字段 | **未见** → R4/R6 不可自动报数 |
| generalcost 单位 | **待财务确认** → 见 [readiness](/projects/temperedheroes/analytics-readiness.md) |

# Citations

[1] 用户陈述（2026-06-17 对话确认）
[2] [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)
[3] [行业付费术语](/references/industry-glossary/monetization.md)
