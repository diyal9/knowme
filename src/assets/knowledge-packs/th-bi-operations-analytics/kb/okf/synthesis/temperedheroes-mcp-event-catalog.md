---
type: Synthesis
title: 百炼英雄 — MCP 埋点与 TE 资产目录
description: 盘古 project_id=69 + TE projectId=101 元数据梳理（2026-06-18 ingest）。
tags: [temperedheroes, mcp, catalog, events, te]
project_id: 69
te_project_id: 101
owner: 数据组
status: active
timestamp: 2026-06-18T00:00:00Z
---

# Overview

| 项 | 值 |
|----|-----|
| 盘古 `project_id` | **69** |
| TE `projectId` | **101**（TH国服-百炼英雄） |
| 盘古元事件数 | **139**（含表头模板 `t_default` 共 140 条） |
| TE 事件数 | **145** |
| 盘古埋点枚举大类 | **67** | [temperedheroes-catalog](/references/pango-dimensions/temperedheroes-catalog.md) |
| TE 看板（当前账号可见） | **1**（12111 首充 AB） |
| TE 标签（首充 AB） | **2**（15005/15006） |

# 核心事件（已 ingest 详情页）

| 业务 | 盘古 event_name | Wiki Concept | TE eventId |
|------|-----------------|--------------|------------|
| 注册 | `t_register` | [t_register](/behavioral/events/t_register.md) | — |
| 登录 / DAU | `t_login` | [t_login](/behavioral/events/t_login.md) | 39613 |
| 付费 | `t_pay_flow` | [t_pay_flow](/behavioral/events/t_pay_flow.md) | — |
| 通用模板 | `LoginEvent` | [LoginEvent](/behavioral/events/LoginEvent.md) | —（**非百炼生产事件名**） |

# Metric → 事件映射（百炼英雄）

| Metric | 盘古 / TE 事件 | 关键字段 |
|--------|---------------|----------|
| [DAU](/semantic/metrics/dau.md) | `t_login` | `customer_id` 去重 |
| [D1/D7 留存](/semantic/metrics/d1_retention.md) | 初始 `t_register` · 回访 `t_login` | cohort 日 = 注册日 |
| [付费率 / ARPU](/semantic/metrics/pay_rate.md) | `t_pay_flow` | `generalcost` 分子 · `t_login` 分母 |
| 首充 AB | `t_register` + `t_pay_flow` | `area_id` 分流 · `gift_pack_id` |

# TE 独有事件（盘古协议中无同名元事件）

TE `list_events` 中存在、盘古 `list_events` **未返回** 的条目（多为 TE 衍生 / 聚合事件）：

| eventName | 说明 |
|-----------|------|
| `m_goods_flow_inc_h` | 道具流水增量（蓝矿石等） |
| `m_last_element_info` | 元素觉醒日末快照 |
| `m_last_hero_info` | 登出英雄装备日末快照 |
| `m_predict_exclude_return` | 预测排除回流 |
| `m_predict_result` | 预测结果 |
| `t_ads_cost` | 广告花费 |
| `t_ads_income` | 广告收入 |

> ingest / lint 以 **盘古为准**；上表 TE 独有项分析时须在 Playbook 或 Query 中显式标注数据源。

# 盘古元事件分类（139 个，不含 t_default 表头）

## 核心链路（11）

`t_register` · `t_login` · `t_pay_flow` · `t_pay_step` · `t_before_login_step` · `t_novice_step` · `t_online` · `t_online_time` · `t_online_server` · `t_user_report` · `t_user_info`

## 经济与道具（6）

`t_important_flow` · `t_goods_flow` · `t_equipment_flow` · `t_equip_streng` · `t_equip_enchant` · `t_equip_inherit` · `t_equip_up` · `t_equip_inlay` · `t_chestbox_drop`

## 玩法 / 战斗（20+）

`t_dungeon` · `t_arena_challenge` · `t_arena_defense` · `t_climbing_tower` · `t_peak_pvp` · `t_boss_attacked` · `t_task` · `t_training_camp` · `t_hero_lvl` · `t_hero_pub` · `t_team_lvl` · `t_build` · `t_pet` · `t_rogue_buff` · `t_element_war` · `t_teampvp_*` · `t_boundary_*` · `t_temple_challenge` · …

## 活动抽奖（30+）

`t_lottery_*` 系列（dragonboat、turntable、bingo、fishing、worldcup 等）

## 公会 / 联盟（10+）

`t_family` · `t_family_pvp` · `t_alliance` · `t_maze_*` · `t_red_envelope` · …

## 广告 / 归因 / 风控（8）

`t_advert` · `t_adjust` · `t_push_stat` · `t_cheating` · `t_pbc` · `t_fight_check` · `t_ban_acount` · `t_black_list`

## 其他（剩余）

英雄皮肤/专武、元素系统、石板、订阅、问卷、内部账号等。

完整名称清单以盘古 MCP `list_events(project_id=69)` 为准；本页为分类索引，**不替代 MCP 实时拉取**。

# 关键埋点枚举（67 大类 · 摘录）

| 枚举名 | 关联字段 | 用途 |
|--------|----------|------|
| GIFT_PACK_ID | `gift_pack_id` | 礼包 ID（首充 400104/105/106） |
| SCENE_TYPE | `scene_id` | 付费场景（首充 1068） |
| PRODUCT_TYPE | `product_id` | 物品种类 |
| PAY_TYPE | `pay_type_id` | 支付方式 |
| REG_TYPE | `reg_type` | 注册类型 |
| LOGIN_WAY_TYPE | `login_way` | 登录方式 |
| PACKAGE_TYPE | `package` | 渠道包 |
| REASON_TYPE | `reason` | 变动原因 |

# TE 分析资产

| 类型 | ID | 名称 |
|------|-----|------|
| 看板 | **12111** | 首充档位解锁AB实验-百炼英雄-微小渠道 |
| 标签 | **15005** | ab_firstcharge_test（首充AB实验组） |
| 标签 | **15006** | ab_firstcharge_control（首充AB对照组） |

详见 [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)、[第 1 期报告](/synthesis/temperedheroes-first-charge-ab-report-phase1.md)。

# Lint 摘要（2026-06-18）

| 检查项 | 结果 |
|--------|------|
| 核心 trio（register/login/pay）盘古 ↔ TE 事件名 | **一致** |
| Wiki `LoginEvent` vs 生产 `t_login` | **命名差异** — 百炼以 `t_login` 为准，LoginEvent 保留为跨项目模板 |
| TE 独有 m_/ads 事件 | **6+ 条** — 见上表，非协议轨 |
| `t_register` TE lint | 待补 `eventId`（分页未拉） |

# Citations

[1] 盘古 MCP `list_events` / `list_event_properties` / `list_dimensions` project_id=69（2026-06-18）
[2] TE MCP `list_projects` / `list_events` / `list_tags` / `list_dashboards` projectId=101（2026-06-18）
