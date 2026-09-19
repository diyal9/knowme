---
type: Reference
title: 百炼英雄 — 分析就绪度清单
description: 百炼完美数据分析还需补全/确认项；P0 阻塞乱报，P1 提升完整度。
tags: [temperedheroes, readiness, checklist]
project_id: 69
te_project_id: 101
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 就绪度总览

| 域 | 状态 | 说明 |
|----|------|------|
| 项目 ID 映射 | ✅ | 盘古 69 · TE 101 |
| 核心事件 Schema | ✅ | t_register / t_login / t_pay_flow MCP 核验 |
| 枚举 L1 目录 | ✅ | 67 大类 + refresh 策略 |
| 生产 Metric 口径 | ✅ | [metric-implementation](/projects/temperedheroes/metric-implementation.md) |
| 防乱报门禁 | ✅ | [guardrails](/synthesis/temperedheroes-analytics-guardrails.md) |
| 首充 AB 看板 | ⚠️ | 12111 已建；R4/R6/R8 不完整 |
| 行为层数仓 | ✅ 逻辑层 | [warehouse-logical-ingest](/synthesis/temperedheroes-warehouse-logical-ingest.md) · 物理表待 raw |
| 全局 Metric active | ✅ | DAU / D1 / D7 / pay_rate / ARPU 已升 active（生产口径仍以本项目实现页为准） |

---

## P0 — 不确认则禁止向业务报「元」或强结论

| # | 项 | 现状 | 需要谁 / 做什么 |
|---|-----|------|----------------|
| 1 | **`generalcost` 单位** | TE 原始值；报告用其算人均 ≈5.34 | **财务/数据组确认**：分 / 厘 / 元；确认后写入 [t_pay_flow](/behavioral/events/t_pay_flow.md) |
| 2 | **实验实际开服日** | 声明 5/20~5/26 区服 **0 注册** | **策划/运营确认**真实实验启动 vs 区服开进（5/27 起） |
| 3 | **platform 过滤** | `temperedheroes_cn` 在 AB 窗返回 0 | **数据组确认**：微小渠道是否仅用 area_id 列表即可；见 [Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md) |
| 4 | **样本不均衡** | 实验组新进 +20% | 报告须声明；决策前需分服/分日均衡或加权 |
| 5 | **R8 护栏** | 第 1 期报告「待补」 | TE 跑 R8 或读报表 87751–87758 补全 |

---

## P1 — 提升分析完整度（不阻塞基础查数）

| # | 项 | 现状 | 动作 |
|---|-----|------|------|
| 6 | 档位解锁 R4 / 提前解锁 R6 | 无埋点 | 提需求补「档位解锁」事件 + `unlock_reason` |
| 7 | `t_pay_flow` TE eventId | 未写入 Wiki | lint 时补 eventId |
| 8 | 测试号 / 内部账号剔除 | 未定义 | Segment 或 filter 规则 + Playbook |
| 9 | 退款是否回滚付费 | 未定义 | 与财务对齐后写入 pay_rate / ARPU |
| 10 | 数仓表 `lands_in` | ✅ 已补逻辑链路 | 下一步 ingest 物理表，替换 `logical://` resource |
| 11 | D1 cohort 全局 Conflict | open | 百炼已用 t_register；全局 Conflict 可标「百炼 resolved」侧记 |
| 12 | 项目 index `status` | draft | 核心链路就绪后可升 **active** |

---

## P2 — 体验与自动化

| # | 项 | 动作 |
|---|-----|------|
| 13 | per-project lint 脚本 | 事件/enum/catalog 快照 diff |
| 14 | 第 2 期 AB 报告自动化 | 模板 + TE 报表 ID 绑定 |
| 15 | Cherry KB / raw 案例库 | 历史分析报告 ingest |

---

## AB 实验专用（首充档位）

| 报表 | reportId | 状态 |
|------|----------|------|
| R1 样本 | 87751 | ✅ |
| R2 漏斗 | 87752/87753 | ✅ |
| R3 流水 | 87754/87755 | ✅ |
| R5 分档购买 | 87756 | ✅ |
| R7 D1 留存 | 87757/87758 | ✅ |
| R4 解锁漏斗 | — | ❌ 缺埋点 |
| R6 提前解锁 | — | ❌ 缺埋点 |
| R8 付费率/ARPU | — | ⚠️ 待跑数 |

有效数据窗（第 1 期）：**2026-05-27 ~ 2026-05-31**

---

## 已就绪文档索引

| 文档 | 用途 |
|------|------|
| [metric-implementation](/projects/temperedheroes/metric-implementation.md) | **查数口径** |
| [analytics-guardrails](/synthesis/temperedheroes-analytics-guardrails.md) | **防乱报** |
| [mcp-event-catalog](/synthesis/temperedheroes-mcp-event-catalog.md) | 事件/TE 资产 |
| [enum catalog](/references/pango-dimensions/temperedheroes-catalog.md) | 枚举大类 |
| [first-charge-enums](/references/pango-dimensions/temperedheroes-first-charge-enums.md) | 首充 pin 值 |
| [Playbook](/semantic/playbooks/first-charge-tier-ab-test.md) | AB SOP |

# Citations

[1] MCP + 第 1 期报告综合（2026-06-18）
