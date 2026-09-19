---
type: Reference
title: 指尖战纪 FF — 分析就绪度清单
description: FF 多项目并存下的 P0 阻塞与 P1/P2 提升项。
tags: [fingertipff, readiness, checklist, multi-project]
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 就绪度总览

| 域 | 状态 | 说明 |
|----|------|------|
| TE projectId 映射 | ✅ | **249** |
| 盘古 project_id | ✅ | **82**（`fingertipfantasy` / 指尖战纪） |
| 盘古 MCP 数据 scope | ⚠️ | `list_events`/`list_dimensions` project_id=82 当前账号越权 |
| 防乱报门禁 | ✅ | [guardrails](/synthesis/fingertipff-analytics-guardrails.md) |
| 跨项目对照 | ✅ | [field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md) |
| 报表导出 | ✅ | [multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md) |
| 核心 TE 报表 pin | ✅ | [core-reports-catalog](/synthesis/fingertipff-core-reports-catalog.md) |
| 核心事件 Wiki | ✅ | [t_register](/behavioral/events/t_register_fingertipff.md) · [t_login](/behavioral/events/t_login_fingertipff.md) · [t_pay_flow](/behavioral/events/t_pay_flow_fingertipff.md) |
| TE 查询模板 | ✅ | [queries](/behavioral/queries/index.md#指尖战纪-ff) |
| 盘古枚举 L1 | ⚠️ | [catalog draft](/references/pango-dimensions/fingertipff-catalog.md) — MCP scope 待开通 |
| AB Playbook | ❌ | 无 |

---

## P0 — 不确认则禁止向业务报「元」或跨项目数字

| # | 项 | 现状 | 需要谁 / 做什么 |
|---|-----|------|----------------|
| 1 | **`cost` 单位** | TE 有 `#vp@cost_yuan`（元） | 对外报「元」用 `cost_yuan`；`cost` 非元场景仍建议财务确认 |
| 2 | **业务日 / 时区** | TE offset=0，`timeZoneEnabled=false` | 查数/导出前与用户确认是否 UTC+8 切日；百炼默认 +8 |
| 3 | **盘古 MCP 数据 scope** | `list_events`/`list_dimensions` 越权 | 申请数据中心 scope；元信息已用 `list_projects`/`get_project_detail` 锁定 **82** |
| 4 | **区服字段** | FF 核心事件用 **`server_id`**，无 `area_id` | 已文档化；`area_opr` 须按事件核验 |
| 5 | **跨项目 Session** | 与百炼同仓 | 换项目必须 F-4 + 清空 filters → [operating-guide](/synthesis/multi-project-operating-guide.md) |

---

## P1 — 提升完整度（不阻塞基础 DAU/留存/付费）

| # | 项 | 动作 |
|---|-----|------|
| 6 | `platform` 枚举值 | TE `list_properties` scope=user 现查；常用值 pin 到 filter-registry |
| 7 | 测试号剔除 | Segment 或 filter 规则 |
| 8 | 退款是否回滚付费 | 与财务对齐后写入 pay_rate / ARPU |
| 9 | 角色 vs 账号 cohort | TE 标签含「角色」「账号」维度 → Playbook 须声明主体 |
| 10 | 事件全量 catalog | [mcp-event-catalog](/synthesis/fingertipff-mcp-event-catalog.md) 季度 lint |

---

## P2 — 体验与自动化

| # | 项 | 动作 |
|---|-----|------|
| 11 | per-project lint 脚本 | TH + FF 事件/属性快照 diff |
| 12 | 全局 Metric Implementation 段 | 各 Metric 页链到本项目实现 |
| 13 | Agent memory `project_slug` | episode meta 带项目，防跨项目记忆污染 |

---

## 多项目联调检查表（TH + FF）

- [ ] 会话开场或换项目：F-4 选项含 **temperedheroes (69/101)** 与 **fingertipff (TE 249)**
- [ ] 百炼 AB 不过滤到 FF；FF 不用 `area_id` / `generalcost`
- [ ] `confirmed_by_user=false` 时不跑 TE
- [ ] 输出答案标注 **项目 slug + TE projectId**
