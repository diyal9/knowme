---
type: Synthesis
title: 指尖战纪 FF — 核心报表目录（TE）
description: TE projectId=249 核心 KPI 相关报表 pin；全量以 list_reports 为准。
tags: [fingertipff, te, reports, catalog]
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T15:30:00Z
---

# 项目映射

| 项 | 值 |
|----|-----|
| TE `projectId` | **249** |
| Wiki slug | `fingertipff` |
| TE 报表总数（快照） | **142+** |

导出须知：[multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md)

---

# 核心 KPI 报表（pin）

> `reportModel`：0=事件分析，1=留存，7=分布/其他（TE 枚举，仅供参考）。

## 留存

| reportId | 报表名 | 备注 |
|----------|--------|------|
| **82904** | 注册留存【全渠道】 | 账号维度全渠道 |
| **87158** | 账号维度-注册留存 | |
| **87161** | 角色维度-注册留存 | 角色 cohort |
| **87159** | 账号维度分系统注册留存-iOS | 分端 |
| **87160** | 账号维度分系统注册留存-安卓 | 分端 |
| **87844** | 解锁首充用户留存 | 首充场景留存 |

## 付费 / 活跃

| reportId | 报表名 | 备注 |
|----------|--------|------|
| **87052** | 活跃数据 | 活跃概览 |
| **87050** | 角色活跃数据 | 角色维度 |
| **87162** | 注册首日付费玩家留存 | 付费 cohort |
| **87225** | 分场景&分日充值金额-角色颗粒度 | 金额字段通常为 `cost` |
| **87309** | 角色付费率校准：以触发首充为分母 | 非标准 R8，须读报表定义 |

## 漏斗（运营常用）

| reportId | 报表名 |
|----------|--------|
| **87111** | 角色首日付费漏斗：注册→新手引导→首充曝光→付费 |
| **87040** | 首日新手引导漏斗：全角色 |

---

# 与百炼报表不可互换

| 百炼（101） | FF（249） |
|-------------|-----------|
| 首充 AB **87751–87758** | 无对应 AB 套件 |
| 过滤器含 `area_id` | 须 `server_id` 等 |
| ARPU 列 `generalcost` | 列 `cost` / `#vp@cost_yuan` |

---

# 维护

1. `list_reports` projectId=249 → 与上表 diff
2. 新增核心 KPI 报表 → 追加本页并更新 [field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)
3. 导出 CSV 后核对表头与 [filter-registry](/projects/fingertipff/filter-registry.md)

# Citations

[1] TE MCP `list_reports` projectId=249（2026-07-10）
