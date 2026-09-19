---
type: Synthesis
title: 百炼英雄 — KB 健康分看板（冲刺版）
description: 面向 88 分冲刺的知识链路健康检查，聚焦 lands_in、aggregated_from、冲突与可用查询。
project_id: 69
tags: [temperedheroes, health-check, lint, scorecard]
owner: 数据组
status: active
timestamp: 2026-06-18T00:00:00Z
---

# Scorecard（2026-06-18）

| 维度 | 检查项 | 当前状态 |
|------|--------|----------|
| 链路完整性 | 核心事件 `lands_in` 是否为空 | ✅ `t_register` / `t_login` / `t_pay_flow` 已补齐 |
| 语义到行为 | 核心 Metric `aggregated_from` | ✅ DAU/D1/D7/付费率/ARPU 已补齐 |
| 查询可复用 | 是否有项目级 Query Template | ✅ 已新增 3 条模板（DAU、D1D7、AB KPI） |
| 争议治理 | open Conflict 是否显式暴露 | ✅ 保持显式 open，避免静默猜测 |
| 生产可执行性 | 项目实现页是否可直接跑数 | ✅ 以 [metric-implementation](/projects/temperedheroes/metric-implementation.md) 为准 |

# 日常巡检建议（可复制）

1. 扫描空链路：`lands_in: []` 与 `aggregated_from: []`
2. 扫描冲突：`/synthesis/conflicts/index.md` 中 `status: open`
3. 核查入口：`projects/temperedheroes/index.md` P0 文档是否可直达
4. 抽测模板：3 条 Query Template 是否仍匹配当前口径
5. 若新增项目：先创建 `filter-registry` 再接入 Metric/Event/Table

# 下一步（冲刺 88+ 的剩余项）

* 物理数仓表 ingest：将 `logical://` 替换为真实库表资源
* 关闭 P0 冲突：`generalcost` 单位、platform 过滤、实验开服日
* 新增自动化 lint 脚本（当前为文档化看板）

# 相关

* [百炼就绪度清单](/projects/temperedheroes/analytics-readiness.md)
* [口径争议索引](/synthesis/conflicts/index.md)
* [百炼生产指标实现](/projects/temperedheroes/metric-implementation.md)
