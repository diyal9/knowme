---
type: Synthesis
title: 百炼英雄 · 首充 AB 看板搭建规格（TE）
description: TE 看板「首充档位解锁 AB 实验」报表清单、过滤器与创建顺序。
tags: [dashboard, ab-test, temperedheroes, te]
project_id: 69
owner: 数据组
status: draft
playbook: /semantic/playbooks/first-charge-tier-ab-test.md
timestamp: 2026-06-17T00:00:00Z
---

# 看板信息

| 项 | 建议值 |
|----|--------|
| 看板名称 | `首充档位解锁AB实验-百炼英雄-微小渠道` |
| 前置标签 | `ab_firstcharge_test`、`ab_firstcharge_control` |
| 全局过滤 | `platform=temperedheroes_cn` + 实验/对照区服列表 |
| Cohort | 声明 **2026-05-20~05-26**；TE 有效新进自 **2026-05-27** 起 |
| 区服字段 | **`area_id`**（盘古核验，非 server_id） |
| TE projectId | **101**（TH国服-百炼英雄；盘古 69） |
| 看板 ID | **12111** — `/#/panel/panel/101_12111` |
| 标签 ID | `ab_firstcharge_test` **15005** · `ab_firstcharge_control` **15006** |

# 报表清单（建议 8 张）

## R1 — 实验样本与均衡性

| 项 | 配置 |
|----|------|
| 模型 | `event` |
| 指标 | 新注册用户数（`user_count` @ **t_register**）、DAU（`user_count` @ **t_login**） |
| 分组 | AB 标签（或 **area_id** 实验/对照列表） |
| 过滤 | `platform=temperedheroes_cn`；时间 **2026-05-20~2026-05-26** |
| 粒度 | 按日 |
| 用途 | 判断两组样本是否均衡、实验是否稳定运行 |

**Guided 示例意图**（有 TE 权限后 `build_event_analysis_qp`）：

> 百炼英雄，微小渠道，按首充AB实验组/对照组标签分组，统计每日新注册用户数和DAU，时间范围 custom [实验开始日, 昨天]

## R2 — 新用户首充转化率

| 项 | 配置 |
|----|------|
| 模型 | `funnel` 或 `event` 公式指标 |
| 漏斗 | **t_register** → **t_pay_flow**（gift_pack_id∈400104/105/106 或 scene_id=1068） |
| 分组 | AB 标签 |
| 主 KPI | **是** |

## R3 — 首充礼包流水与人均

| 项 | 配置 |
|----|------|
| 模型 | `event` |
| 指标 | `sum(付费金额)`、`sum(付费金额)/user_count(注册)` |
| 过滤 | gift_pack_id **400104/400105/400106** 或 scene_id=**1068** |
| 分组 | AB 标签 |

## R4 — 档位解锁漏斗（分档）

| 项 | 配置 |
|----|------|
| 模型 | `funnel` |
| 步骤 | 注册 → 解锁档1 → 解锁档2 → … → 解锁档N |
| 分组 | AB 标签 |
| 下钻 | 按档位序号 group |

**依赖**：档位解锁事件 + `tier_index`（或等价属性）。

## R5 — 档位购买率（分档）

| 项 | 配置 |
|----|------|
| 模型 | `event` |
| 指标 | 各档 PayEvent `user_count`，分母=新注册用户 |
| 分组 | AB 标签 × 档位 |

## R6 — 提前解锁占比（实验组专用）

| 项 | 配置 |
|----|------|
| 模型 | `event` |
| 指标 | 解锁事件中 `unlock_reason= purchase` 的用户数 / 全部解锁用户 |
| 分组 | 仅实验组标签；可按档位拆分 |
| 备注 | **无解锁原因字段则本张无法自动建，需 SQL 或补埋点** |

## R7 — D1 / D7 留存（护栏）

| 项 | 配置 |
|----|------|
| 模型 | `retention` |
| 初始 | RegisterEvent（或 TE 项目注册定义） |
| 回访 | LoginEvent |
| unitNum | 1 / 7 |
| 分组 | AB 标签 |

## R8 — 整体付费率与 ARPU（护栏）

| 项 | 配置 |
|----|------|
| 模型 | `event` 公式 |
| 指标 | 付费率 = PayEvent 用户 / Login 用户；ARPU = sum(金额)/Login 用户 |
| 分组 | AB 标签 |

# TE MCP 创建顺序

1. `create_tag` × 2（实验组 / 对照组）
2. `build_*_analysis_qp` + `query_adhoc` 验证每张报表 QP
3. `create_report` × 8（`dashboardIds` 留空先建）
4. `create_dashboard`（`dashboardName` + `noteContent` 写实验说明）
5. `update_dashboard` 关联全部报表（若 MCP 支持）
6. `get_resource_url` 返回看板链接

# 看板说明 Note（建议粘贴）

```markdown
## 实验说明
- 渠道：微小 platform=temperedheroes_cn
- 对照组：天数解锁下一档 | 区服 9994,9996,9998,10000,10002,10004,10006,10008,10010
- 实验组：+购买前置档解锁 | 区服 9993,9995,9997,9999,10001,10003,10005,10007,10009
- Cohort：实验开始后新注册用户
- 实验开始日：【待填】
- Playbook：kb/okf/semantic/playbooks/first-charge-tier-ab-test.md
```

# 创建记录（2026-06-17）

| 报表 | reportId |
|------|----------|
| R1 样本均衡 | 87751 |
| R2 首充漏斗-实验/对照 | 87752 / 87753 |
| R3 首充流水-实验/对照 | 87754 / 87755 |
| R5 分档购买-实验 | 87756 |
| R7 D1留存-实验/对照 | 87757 / 87758 |
| R4/R6 | **未建**（缺解锁事件/解锁原因字段） |

# 仍开放项

| 项 | 说明 |
|----|------|
| 解锁原因埋点 | R4/R6 无专用「档位解锁」事件 |
| platform 过滤 | 用户属性 `temperedheroes_cn` 在 5/27~5/31 窗口返回 0，当前看板仅用 area_id |
| 实验期对齐 | 声明 5/20~5/26 无注册，需确认实际开服日 |

# 已核验（盘古 MCP）

- 事件：`t_register`、`t_login`、`t_pay_flow`、`t_pay_step`
- 区服字段：**`area_id`**
- 首充礼包：400104 / 400105 / 400106；场景 1068

# Citations

[1] [Playbook](/semantic/playbooks/first-charge-tier-ab-test.md)
[2] TE MCP 调用记录（2026-06-17，权限失败）
