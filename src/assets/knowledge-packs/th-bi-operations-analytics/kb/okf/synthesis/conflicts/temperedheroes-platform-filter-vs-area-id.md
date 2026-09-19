---
type: Conflict
title: 百炼 AB — platform 用户属性 vs area_id 区服过滤
status: open
parties:
  - Playbook/Segment：platform=temperedheroes_cn + area_id 列表
  - TE 查数（2026-06-17 第 1 期）：platform 过滤在 5/27~5/31 窗口返回 0
  - 实际看板：仅 area_id 区服列表
project_id: 69
timestamp: 2026-06-18T00:00:00Z
---

# 差异

| 来源 | 过滤器 |
|------|--------|
| 实验设计 / Segment | `platform == 'temperedheroes_cn'` **AND** area_id ∈ 实验/对照列表 |
| TE 第 1 期跑数 | 加 platform 后 **0 样本**；去掉 platform、仅 **area_id** 有数据 |
| TE 用户属性 | `platform` propId=**575530**，desc「平台(注册时)」 |

# 可能影响

- 若 platform 值不是 `temperedheroes_cn`（大小写/枚举差异），渠道过滤失效或误杀。
- 若微小渠道区服列表已唯一标识实验人群，platform 过滤冗余。
- 跨渠道区服误开时，仅 area_id 可能混入非微小用户。

# 百炼 Agent 临时规则（待裁定）

**AB 报告与看板复现**：在 2026-05-27~05-31 窗内，以 **`area_id` 列表** 为准；**不单独加** platform 过滤，直至数据组裁定。

# 项目侧记（百炼 · project_id=69）

| 项 | 状态 |
|----|------|
| TE 跑数 / AB 报告 | **已按 area_id 执行**（见 [filter-registry § AB](/projects/temperedheroes/filter-registry.md)） |
| platform 用户属性 | **deferred** — filter-registry `client_os` slot 标注 open conflict |
| 全局 Conflict | 仍为 **open** — 待数据组确认 platform 枚举与是否需双条件 |

Agent 查百炼 AB：**以 filter-registry + guardrails 为准**，勿单独加 `platform=temperedheroes_cn`。

# 建议裁定

数据组确认：① TE 中微小渠道 platform 实际枚举值；② AB 是否必须双条件；③ 标签 15005/15006 条件是否需更新。

# 相关

- [metric-implementation](/projects/temperedheroes/metric-implementation.md)
- [guardrails](/synthesis/temperedheroes-analytics-guardrails.md)
