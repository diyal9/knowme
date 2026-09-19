---
type: Synthesis
title: FF vs 百炼 — 字段与口径对照（canonical）
description: 指尖战纪 FF 与百炼英雄在 TE 查数、过滤器、金额、时区、报表导出上的权威对照表；多项目并存时首选读本页。
tags: [fingertipff, temperedheroes, multi-project, field-diff, comparison]
status: active
owner: 数据组
timestamp: 2026-07-10T15:30:00Z
---

# 适用范围

本页为 **FF（fingertipff）** 与 **百炼（temperedheroes）** 跨项目对照的 **canonical 入口**。查数、拼表、导出 CSV 前应先锁 `project_slug`，再读本页对应行。

| slug | 中文名 | 盘古 ID | TE ID |
|------|--------|---------|-------|
| `temperedheroes` | 百炼英雄 | **69** | **101** |
| `fingertipff` | 指尖战纪 FF | **82** | **249** |

操作 SOP：[multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)  
报表导出：[multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md)

---

# 1. 项目与身份映射

| 项 | 百炼 | FF | 混用后果 |
|----|------|-----|----------|
| TE `projectId` | 101 | 249 | 查错项目 → 数字全错 |
| 盘古 `project_id` | 69 | 82 | 枚举/埋点 MCP 查错 |
| TE `appid` | 百炼 appid | `c3645f77…` | 勿混用 |
| 用户去重字段 | `customer_id` | `customer_id` | ✅ 相同 |
| 生产事件名 | `t_register` / `t_login` / `t_pay_flow` | **同名** | 事件名相同≠属性相同 |

---

# 2. 核心事件（TE）

| 业务 | 事件名 | 百炼 eventId | FF eventId | Wiki |
|------|--------|--------------|------------|------|
| 注册 cohort | `t_register` | 39612 | 64146 | [百炼](/behavioral/events/t_register.md) · [FF](/behavioral/events/t_register_fingertipff.md) |
| 登录 / DAU | `t_login` | 39613 | 64147 | [百炼](/behavioral/events/t_login.md) · [FF](/behavioral/events/t_login_fingertipff.md) |
| 付费流水 | `t_pay_flow` | — | 64841 | [百炼](/behavioral/events/t_pay_flow.md) · [FF](/behavioral/events/t_pay_flow_fingertipff.md) |
| 付费步骤（漏斗） | — | — | `t_pay_step` 64834 | FF 特有 |

---

# 3. 过滤器 / 维度字段（P0）

| 业务口语 | 百炼 | FF | 备注 |
|----------|------|-----|------|
| **区服 / 实验服** | **`area_id`**（int） | **无 `area_id`** | FF 用 **`server_id`**（核心事件已确认） |
| 区服（备选） | — | `area_opr`（propId 579396） | TE 显示名「行为类型」；**未必挂在核心事件上**，过滤前须 `list_properties` 按事件核验 |
| 发行渠道 | 用户属性 `platform`（575530） | 用户属性 `platform`（575516） | **枚举不可互拷** |
| 事件级 platform | 有 `event_platform` slot | 事件 `platform`（575229） | 百炼 AB 曾踩坑：勿默认加 `temperedheroes_cn` |
| 客户端 OS | `os` | `os` | 相同 |
| 渠道包 | `package` | `package`（**number**） | 相同字段名，类型须注意 |
| 广告渠道 | — | `ad_channel`（579398） | FF 特有 |
| 服务器 ID | `server_id`（t_login 专有说明） | `server_id`（575243，核心事件可用） | FF 区服过滤优先用此字段 |

**权威 Slot 表**：[百炼 filter-registry](/projects/temperedheroes/filter-registry.md) · [FF filter-registry](/projects/fingertipff/filter-registry.md)

**Open Conflict**：[area_opr vs area_id](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md)

---

# 4. 金额与 ARPU（P0）

| 项 | 百炼 | FF |
|----|------|-----|
| ARPU / 流水主字段 | **`generalcost`** | **`cost`**（propId 579344） |
| 本地币字段 | `cost`（有，ARPU 不用） | 同 `cost` |
| `generalcost` | ✅ | ❌ **不存在** |
| 元口径虚拟属性 | — | **`#vp@cost_yuan`**（TE 虚拟属性，描述「付费金额（元）」） |
| 礼包 / 场景 | `gift_pack_id`、`scene_id`（首充 AB） | `scene_id`、`trade_id` 等；无百炼首充三档 pin |

**生产口径**：[百炼 metric-implementation](/projects/temperedheroes/metric-implementation.md) · [FF metric-implementation](/projects/fingertipff/metric-implementation.md)

| 场景 | 百炼 | FF |
|------|------|-----|
| 默认 ARPU 分子 | `sum(generalcost)` | `sum(cost)` |
| 向业务报「元」 | TE 原始单位（已约定） | 优先 `#vp@cost_yuan`；须与财务确认是否统一 |

---

# 5. 时区与业务日

| 项 | 百炼（TE 101） | FF（TE 249） |
|----|----------------|--------------|
| `defaultTimeZoneOffset` | **8**（UTC+8） | **0** |
| `timeZoneEnabled` | **true** | **false** |
| 时区列 | `#vp@timezone0` | 无项目级时区列配置 |
| 业务日切 | 默认 UTC+8 自然日 | **须与用户确认**是否按 UTC+8 统计 |

**影响**：同一日历日期两项目 DAU/留存数值**不可直接对比**，除非双方确认同一时区窗口。

---

# 6. 核心指标口径（相同 vs 不同）

| 指标 | 相同部分 | 不同部分 |
|------|----------|----------|
| DAU | `t_login` · `customer_id` 去重 | 时区；过滤器字段 |
| D1/D7 留存 | `t_register` → `t_login` | 时区；区服过滤字段 |
| 付费率 | `t_pay_flow` 用户 / `t_login` 用户 | 过滤器 |
| ARPU | 流水 / 活跃用户 | **`generalcost` vs `cost`** |

**TE 查询模板**：[百炼 queries](/behavioral/queries/index.md) · [FF queries](/behavioral/queries/index.md#指尖战纪-ff)

---

# 7. 百炼有、FF 暂无

| 能力 | 百炼 | FF |
|------|------|-----|
| 首充 AB Playbook | ✅ | ❌ |
| TE 标签 15005/15006 | AB 组 | — |
| 数仓逻辑表 DWD/DWS | ✅ | ❌ |
| 盘古枚举 L1 catalog | ✅ active | ⚠️ draft（MCP scope 待开通） |
| 已文档化核心报表 ID | AB 87751–87758 等 | [FF 核心报表目录](/synthesis/fingertipff-core-reports-catalog.md) |

---

# 8. 报表导出差异摘要

详见 [multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md)。

| 风险 | 说明 |
|------|------|
| 跨项目复制报表 URL | TE URL 内嵌 projectId；百炼报表 **不能** 当 FF 模板 |
| CSV 列名 | 百炼可能出现 `area_id`、`generalcost`；FF 为 `server_id`/`cost` |
| MCP 替代导出 | `query_report_data` **不能** 等价全量页面导出 |
| FF 时区 | 导出日期可能与业务认知差 8 小时，须核对报表时间设置 |

---

# 9. Agent / 分析师检查清单

换项目或拼表前：

- [ ] `project_slug` + TE `projectId` 已锁定
- [ ] 已读对应 `filter-registry` + `metric-implementation`
- [ ] 未沿用上一项目的 `filters[]`
- [ ] 未使用百炼 `area_id` / `generalcost` / `temperedheroes_cn`
- [ ] 金额口径与报表列名一致
- [ ] 时区（尤其 FF）已与需求方确认
- [ ] 导出使用**本项目**报表 URL

---

# 相关

- [多项目操作指南](/synthesis/multi-project-operating-guide.md)
- [多项目 Filter 澄清策略](/synthesis/multi-project-filter-clarification-policy.md)
- [口径冲突索引](/synthesis/conflicts/index.md)
- [TE CSV 导出](/references/te-report-csv-export.md)

# Citations

[1] TE MCP `list_properties` / `get_project_config` projectId=101 vs 249（2026-07-10）
[2] 各项目 filter-registry · metric-implementation · mcp-event-catalog
[3] [fingertipff-area-opr-vs-area-id Conflict](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md)
