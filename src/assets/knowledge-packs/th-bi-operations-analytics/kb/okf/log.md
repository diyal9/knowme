# Bundle Update Log

## [2026-07-10] synthesis | FF + 百炼全量对照与 FF 可用性补齐

* **Creation**: [ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md) — canonical 跨项目对照
* **Creation**: [multi-project-report-export-guide](/synthesis/multi-project-report-export-guide.md) — CSV 导出隔离
* **Creation**: [fingertipff-core-reports-catalog](/synthesis/fingertipff-core-reports-catalog.md) — TE 249 核心报表 pin
* **Creation**: FF 事件 [t_register](/behavioral/events/t_register_fingertipff.md) · [t_login](/behavioral/events/t_login_fingertipff.md) · [t_pay_flow](/behavioral/events/t_pay_flow_fingertipff.md)
* **Creation**: FF TE 查询模板 q_fingertipff_{dau,retention,pay_rate,arpu}
* **Update**: FF filter-registry（server_id 优先、platform 双绑定、field-diff 链）
* **Update**: FF metric-implementation（cost/cost_yuan、时区、server_id）
* **Update**: FF readiness / index · 百炼 index · synthesis/events/queries index · operating-guide · te-report-csv-export · PayEvent · projects/index
* **Update**: Conflict [area_opr vs area_id](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md) — server_id 优先
* **Note**: TE MCP 核验 cost_yuan、时区 101 vs 249；盘古 82 数据 scope 仍 open

## [2026-07-10] update | FF 盘古 project_id 映射

* **Update**: [fingertipff/index](/projects/fingertipff/index.md) — 盘古 **82**（`fingertipfantasy`）↔ TE **249**；双 appid 并列
* **Update**: [projects/index](/projects/index.md)、[multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)、[te-mcp-analysis](/references/te-mcp-analysis.md)、[readiness](/projects/fingertipff/analytics-readiness.md)
* **Note**: `list_events`/`list_dimensions` project_id=82 仍越权；`get_project_detail` 已验证

## [2026-07-10] ingest | 多项目 TH + FF（指尖战纪）

* **Creation**: [fingertipff 项目域](/projects/fingertipff/) — index · filter-registry · metric-implementation · analytics-readiness
* **Creation**: [FF guardrails](/synthesis/fingertipff-analytics-guardrails.md) · [FF event catalog](/synthesis/fingertipff-mcp-event-catalog.md) · [multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)
* **Creation**: open Conflict — [FF area_opr vs 百炼 area_id](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md)
* **Creation**: [fingertipff-catalog](/references/pango-dimensions/fingertipff-catalog.md)（draft · 待盘古 project_id）
* **Update**: [projects/index](/projects/index.md) · [multi-project-filter-clarification-policy](/synthesis/multi-project-filter-clarification-policy.md) · [te-mcp-analysis](/references/te-mcp-analysis.md)
* **Update**: 全局 Metric（dau/d1/d7/pay_rate/arpu）补 FF Implementation 段；LoginEvent/PayEvent 项目映射
* **Update**: 技能 [multi-project-query-clarification](../../../.cursor/skills/th-bi-analytics-assistant/references/multi-project-query-clarification.md)、[first-turn-templates F-2](../../../.cursor/skills/th-bi-analytics-assistant/references/first-turn-templates.md)；memory [episode-schema](../../../.cursor/skills/th-bi-agent-memory/references/episode-schema.md) 增 `project_slug`
* **Note**: FF 盘古 `project_id=82`（`list_projects`）；枚举 L1 待 MCP data scope

## 2026-06-17

* **Update**: 采用 raw/ 10～80 分区归档规范；[Reference raw-archive-layout](/references/raw-archive-layout.md) 与 [info/conventions/raw-archive-layout.md](../../../info/conventions/raw-archive-layout.md)。
* **Initialization**: 创建 th-BI OKF Bundle 骨架与核心 Concept 模板（DAU、D1 留存、LoginEvent、PayEvent、渠道维度）。
* **Creation**: 建立 [根 index](/index.md) 与语义/行为层目录 index。
* **Creation**: 架构方案写入 [kb/ARCHITECTURE.md](../../ARCHITECTURE.md)，Agent 技能包初始化。

## [2026-06-17] ingest | 游戏行业数据分析标准术语手册_20260616

* **Source**: `raw/10-data-basic-knowledge/business-glossary/游戏行业数据分析标准术语手册_20260616/`（5 CSV，345 条）
* **Update**: 新建 [industry-glossary](/references/industry-glossary/) Reference 五模块 + 总索引
* **Creation**: [industry-glossary-policy](/synthesis/industry-glossary-policy.md)（行业参考 vs 项目 override）
* **Creation**: open Conflict — [d1-cohort](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md)、[dnu-formula](/synthesis/conflicts/dnu-formula-industry-vs-standard.md)
* **Update**: [dau](/semantic/metrics/dau.md)、[d1_retention](/semantic/metrics/d1_retention.md)、[pay_rate](/semantic/metrics/pay_rate.md) 补 Industry Reference / Citations
* **Note**: 行业参考，非团队强制口径；Metric 生产口径仍以 Wiki + MCP 为准

## [2026-06-17] ingest | 核心 Metric 扩展 — D7 留存、ARPU

* **Creation**: [d7_retention](/semantic/metrics/d7_retention.md)、[arpu](/semantic/metrics/arpu.md)
* **Update**: [LoginEvent](/behavioral/events/LoginEvent.md)、[PayEvent](/behavioral/events/PayEvent.md) 双向补链；[pay_rate](/semantic/metrics/pay_rate.md) 链 ARPU
* **Update**: [d1-cohort Conflict](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) 扩展至 D7
* **Note**: 两 Metric 均为 draft；RegisterEvent / 数仓表待对接

## [2026-06-17] integration | TE 分析 MCP（user-te-mcp-analysis）

* **Creation**: [te-mcp-analysis](/references/te-mcp-analysis.md)、[te-analysis-policy](/synthesis/te-analysis-policy.md)
* **Creation**: 技能 [te-mcp-analysis-integration.md](../../../.cursor/skills/th-bi-analytics-assistant/references/te-mcp-analysis-integration.md)
* **Update**: 核心 Metric（dau、d1、d7、arpu、pay_rate）补 `te_query_*` frontmatter 与 `# TE Query Hint`
* **Update**: [SCHEMA.md](../../SCHEMA.md)、[ARCHITECTURE.md](../../ARCHITECTURE.md)、[authority-and-conflicts.md](../../../info/conventions/authority-and-conflicts.md)、技能三轨 / workflow / lint
* **Note**: TE `projectId` 与盘古 `project_id` 映射待写入 `projects/`；事件名占位待项目 lint 填实

## [2026-06-17] synthesis | 百炼英雄首充档位 AB 实验

* **Source**: 用户陈述 + 实验确认（微小渠道 platform=temperedheroes_cn，区服分流）
* **Creation**: [projects/temperedheroes](/projects/temperedheroes/index.md)
* **Creation**: [Playbook first-charge-tier-ab-test](/semantic/playbooks/first-charge-tier-ab-test.md)
* **Creation**: Segments [ab-firstcharge-test](/semantic/segments/ab-firstcharge-test.md)、[ab-firstcharge-control](/semantic/segments/ab-firstcharge-control.md)
* **Creation**: [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)、[报告第1期模板](/synthesis/temperedheroes-first-charge-ab-report-phase1-template.md)
* **Note**: TE/盘古 MCP 当前账号无 project_id=69 权限，看板未在 TE 创建；实验开始日、埋点事件名仍为 open

## [2026-06-17] query | 百炼英雄首充 AB · 实验期与盘古 MCP 核验

* **Update**: 实验期 **2026-05-20 ~ 2026-05-26**；区服字段 **`area_id`**
* **Creation**: [t_register](/behavioral/events/t_register.md)、[t_pay_flow](/behavioral/events/t_pay_flow.md)（百炼英雄）
* **Creation**: [报告第 1 期](/synthesis/temperedheroes-first-charge-ab-report-phase1.md)（结构+过滤器；数值待 TE）
* **Update**: [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)、Playbook、AB Segments
* **Note**: 盘古 MCP 已通；**TE MCP 仍 -1006**（`list_projects` 空）。首充礼包 400104/105/106；scene 1068

## [2026-06-17] query+synthesis | 百炼英雄首充 AB · TE 看板与第 1 期跑数

* **Update**: TE `projectId=101`；看板 **12111**；标签 15005/15006；报表 87751–87758
* **Update**: [报告第 1 期](/synthesis/temperedheroes-first-charge-ab-report-phase1.md) 数值回填（有效窗 2026-05-27~05-31）
* **Update**: [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)、[projects/temperedheroes](/projects/temperedheroes/index.md)
* **Note**: 声明实验期 5/20~5/26 实验区服注册为 0；R4/R6 未建（缺解锁埋点）；platform 用户属性过滤待核对

## [2026-06-18] ingest | 百炼英雄 MCP 埋点与 TE 资产梳理

* **Source**: 盘古 MCP `list_events` / `list_event_properties` / `list_dimensions` project_id=69；TE MCP projectId=101
* **Creation**: [MCP 埋点与 TE 资产目录](/synthesis/temperedheroes-mcp-event-catalog.md)（139 盘古元事件 · 145 TE 事件 · 67 枚举）
* **Creation**: [t_login](/behavioral/events/t_login.md)（DAU/留存锚点 · TE eventId=39613）
* **Update**: [t_register](/behavioral/events/t_register.md)、[t_pay_flow](/behavioral/events/t_pay_flow.md) 全量 Schema
* **Update**: [LoginEvent](/behavioral/events/LoginEvent.md)、[PayEvent](/behavioral/events/PayEvent.md) 补 Project Mapping
* **Update**: [dau](/semantic/metrics/dau.md) TE Hint → `t_login`；[behavioral/events/index](/behavioral/events/index.md)、[projects/temperedheroes](/projects/temperedheroes/index.md)
* **Note**: TE 独有 m_/ads 事件 6+ 条；LoginEvent 模板名 ≠ 生产 `t_login`

## [2026-06-18] ingest | 百炼英雄盘古枚举大类（67）

* **Source**: 盘古 MCP `list_dimensions` project_id=69 total=67
* **Creation**: [temperedheroes-catalog](/references/pango-dimensions/temperedheroes-catalog.md)（L1 大类全表 · snapshot 2026-06-18）
* **Creation**: [pango-dimension-catalog-policy](/synthesis/pango-dimension-catalog-policy.md)（L1 refresh + L2 现查/pin 策略）
* **Update**: [references/pango-dimensions/index](/references/pango-dimensions/index.md)、[semantic/dimensions/index](/semantic/dimensions/index.md)、[projects/temperedheroes](/projects/temperedheroes/index.md)
* **Note**: 枚举 **值** 不固化进 Wiki；Playbook 引用值见 Event pin + `last_verified`

## [2026-06-18] synthesis | 百炼完美分析 — 口径 / 门禁 / 就绪度

* **Creation**: [metric-implementation](/projects/temperedheroes/metric-implementation.md)（生产 TE 口径）
* **Creation**: [analytics-guardrails](/synthesis/temperedheroes-analytics-guardrails.md)（防乱报红线）
* **Creation**: [analytics-readiness](/projects/temperedheroes/analytics-readiness.md)（P0/P1 缺口清单）
* **Creation**: [first-charge-enums pin](/references/pango-dimensions/temperedheroes-first-charge-enums.md)
* **Creation**: open Conflict [platform vs area_id](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)
* **Update**: 核心 Metric 补百炼 Implementation；`t_register` te_eventId=39612；项目 index → active
* **Note**: P0 待确认 — generalcost 单位、实验开服日、R8 护栏、R4/R6 埋点

## [2026-06-18] synthesis | 三层架构安全性与准确性评估

* **Creation**: [architecture-safety-accuracy-review](/synthesis/architecture-safety-accuracy-review.md)（元数据/数值/语义记忆三层；准确性风险 + Langfuse 钩子脱敏缺口）
* **Update**: [synthesis/index](/synthesis/index.md) 挂链
* **Note**: 机密性整改（redact 值级脱敏 / .env 拦截）触及 .cursor/**，待 maintainer 授权后另行执行；本轮仅记录评估

## [2026-06-18] synthesis | 冲突裁定 Checklist + t_pay_flow Schema 补齐

* **Creation**: [conflict-resolution-checklist](/synthesis/conflict-resolution-checklist.md)（盘古/TE/Wiki 分步裁定）
* **Update**: [t_pay_flow](/behavioral/events/t_pay_flow.md) 补 `adjustid`（MCP lint diff）
* **Update**: [synthesis/index](/synthesis/index.md)、[conflicts/index](/synthesis/conflicts/index.md) 链入 Checklist

## [2026-06-18] synthesis | 多项目 Filter Slot 与结构化澄清

* **Creation**: [filter-registry](/projects/temperedheroes/filter-registry.md)（百炼 6 slot + AB 默认规则）
* **Creation**: [multi-project-filter-clarification-policy](/synthesis/multi-project-filter-clarification-policy.md)（Session Schema）
* **Creation**: 技能 [multi-project-query-clarification.md](../../../.cursor/skills/th-bi-analytics-assistant/references/multi-project-query-clarification.md)、[first-turn-templates 模板 F](../../../.cursor/skills/th-bi-analytics-assistant/references/first-turn-templates.md)
* **Update**: [projects/index](/projects/index.md)、[guardrails](/synthesis/temperedheroes-analytics-guardrails.md)、[platform 属性](/behavioral/events/properties/platform.md)
* **Note**: 新项目 onboarding 须先建 filter-registry

## [2026-06-18] synthesis | Session 项目漂移 + 基础参数 MCP 澄清

* **Update**: [multi-project-filter-clarification-policy](/synthesis/multi-project-filter-clarification-policy.md) — L0 漂移检测、Session 字段扩展、澄清阶段 MCP 映射
* **Update**: 技能 [multi-project-query-clarification.md](../../../.cursor/skills/th-bi-analytics-assistant/references/multi-project-query-clarification.md)、[first-turn-templates 模板 F-4](../../../.cursor/skills/th-bi-analytics-assistant/references/first-turn-templates.md)、[pango-mcp-integration 澄清段](../../../.cursor/skills/th-bi-analytics-assistant/references/pango-mcp-integration.md)、[SKILL.md](../../../.cursor/skills/th-bi-analytics-assistant/SKILL.md)
* **Update**: [filter-registry](/projects/temperedheroes/filter-registry.md) — 标明仅适用于 temperedheroes

## [2026-06-18] lint | Wiki 去噪 — 导航补链 + 双轨收敛

* **Update**: [synthesis/index](/synthesis/index.md)、[projects/temperedheroes/index](/projects/temperedheroes/index.md) — 补链报告空白模板
* **Update**: [tables](/behavioral/tables/index.md)、[queries](/behavioral/queries/index.md)、[pipelines](/behavioral/pipelines/index.md) — 标 deferred + 链 readiness
* **Update**: 3 open Conflict 加百炼项目侧记；[conflicts/index](/synthesis/conflicts/index.md) 增「百炼侧记」列
* **Update**: 全局 Metric（dau/d1/d7/pay_rate/arpu）Definition 区分抽象 vs 百炼生产
* **Update**: [te-mcp-analysis](/references/te-mcp-analysis.md) — 生产/模板双列映射 + 项目 ID 链
* **Update**: [industry-glossary/index](/references/industry-glossary/index.md) — 低交叉引用模块说明
* **Note**: Conflict 全局仍为 open；数仓 ingest 待 raw 资料

## [2026-06-18] ingest | 百炼数仓逻辑层（无 raw 物理 Schema）

* **Creation**: [dwd/dim/dws/ads 逻辑表](/behavioral/tables/index.md) — t_default MCP 表头 + 核心事件
* **Creation**: [Pipeline TE→DWD](/behavioral/pipelines/pip_temperedheroes_te_event_to_dwd.md)
* **Creation**: Query 模板 ×4（DAU · D1 · pay_rate · ARPU）
* **Creation**: [ingest 说明](/synthesis/temperedheroes-warehouse-logical-ingest.md)
* **Update**: Event `lands_in` · Metric `aggregated_from` 双向补链
* **Update**: [readiness](/projects/temperedheroes/analytics-readiness.md) · [sources-index](../../../raw/sources-index.md)
* **Note**: `resource=logical://` 占位；物理 Hive/BQ 表名待 raw 归档后二次 ingest

## [2026-06-18] sprint | 冲刺 88 分 — 最小链路补齐（temperedheroes）

* **Creation**: Data Table 逻辑链路 [dwd_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)、[dws_user_daily_logical](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)、[ads_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md)
* **Creation**: Query Template 三件套 [q_dau_daily](/behavioral/queries/q_temperedheroes_dau_daily.md)、[q_retention_d1d7](/behavioral/queries/q_temperedheroes_retention_d1d7.md)、[q_ab_firstcharge_core_kpis](/behavioral/queries/q_temperedheroes_ab_firstcharge_core_kpis.md)
* **Update**: 核心事件 [t_register](/behavioral/events/t_register.md)、[t_login](/behavioral/events/t_login.md)、[t_pay_flow](/behavioral/events/t_pay_flow.md) 补齐 `lands_in`
* **Update**: 核心 Metric [dau](/semantic/metrics/dau.md)、[d1](/semantic/metrics/d1_retention.md)、[d7](/semantic/metrics/d7_retention.md)、[pay_rate](/semantic/metrics/pay_rate.md)、[arpu](/semantic/metrics/arpu.md) 升 `active` 并补 `aggregated_from`
* **Creation**: [KB 健康分看板](/synthesis/temperedheroes-kb-health-scorecard.md)；并更新 [synthesis/index](/synthesis/index.md)、[projects/temperedheroes/index](/projects/temperedheroes/index.md)、[analytics-readiness](/projects/temperedheroes/analytics-readiness.md)
* **Note**: 当前补齐为逻辑链路（`logical://` resource）；真实物理表与自动 lint 脚本待 maintainer 范围授权后继续