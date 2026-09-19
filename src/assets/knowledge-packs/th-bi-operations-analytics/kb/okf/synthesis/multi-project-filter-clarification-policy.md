---
type: Synthesis
title: 多项目 — Filter Slot 与结构化澄清策略
description: 跨项目复用的会话参数模型；「平台」消歧；Session Schema 约定。
tags: [multi-project, filter, clarification, platform, policy]
status: active
owner: 数据组
timestamp: 2026-06-18T12:00:00Z
---

# 问题

多项目分析时，用户口语 **「平台」** 可能指：发行渠道、客户端 OS、渠道包、区服。静默映射到字段 `platform` 会导致 **跨项目乱报**（百炼 AB 已验证）。

跨轮对话中若 **项目信号与 Session 不一致**（如上轮百炼、本轮说「FF DAU」「指尖战纪留存」），静默沿用旧 Session 会导致 filter-registry、metric-implementation、TE projectId 全部错配。

# 设计原则

1. **不设全局 `platform` 参数** → 使用 **Filter Slot**（业务语义 id）
2. **Slot → 字段绑定在项目 Registry** → `projects/<slug>/filter-registry.md`
3. **无默认值优于猜默认值** → open Conflict 的 slot 标 `deferred`
4. **先项目、后意图、再过滤器、最后 TE 执行**
5. **Session 项目是唯一上下文锚点** → 跨轮项目漂移须结构化重选，禁止静默切换

# 澄清顺序（L0→L3）

| 层 | 参数 | 未填则 |
|----|------|--------|
| L0 | `project_slug` / pango_id / te_id | 禁止项目数字 |
| L1 | `task`（query/ingest/lint/definition） | 按 definition 只读 Wiki |
| L1 | `time_range`（查数） | 禁止 query_adhoc |
| L2 | `filters[]`（按 slot） | 用户提到平台/渠道/区服时必澄清 |
| L3 | 事件名、builder（Agent 内部） | 读项目 metric-implementation |

# Session 项目一致性（L0 门禁 · 第 0 步）

每一轮解析用户输入后，须将 **本轮目标项目** 与 Session 中 **最近一次锁定/确认的 `project_slug`** 比对。

## 触发重选

| 信号 | 示例 |
|------|------|
| 显式换项目 | 「换成 FF」「查一下百炼」「指尖战纪」 |
| ID 冲突 | Session 为 TE 101，用户给出 pango `project_id=2` |
| 隐式换项目 | 上轮百炼，本轮语境指向 FF/指尖战纪且未说「还是百炼/同上」 |
| 过滤器语境冲突 | Session 百炼，用户提到仅存在于其他项目的 slot/枚举 |

## 不触发（同项目延续）

- 仅补充时间、指标、区服列表
- 「还是百炼」「同上」「刚才那个项目」

## 漂移后 Agent 行为

1. `confirmed_by_user` → **false**（即使 L1/L2 看似齐全）
2. `filters[]` **清空或标 `stale`**（slot 绑定项目级 registry，不可跨项目沿用）
3. **禁止** TE `query_adhoc` 与项目数字输出
4. 用 **模板 F-4** 结构化重选项目（选项来自盘古 `list_user_projects` + Wiki `projects/*/index.md`）
5. 重选后 **重读** 该项目的 `index.md` + `filter-registry.md` + `metric-implementation.md`
6. 时间/指标若仍有效可保留；**L2 过滤器须按新项目 registry 重审** → 再走 F-3 复述确认

# 基础参数 MCP 查询（L0/L2 动态选项）

静态 Slot 定义在项目 filter-registry；**枚举候选值**在澄清阶段按需 MCP 现查：

| 参数层 | 静态来源 | MCP（澄清阶段） |
|--------|----------|-----------------|
| L0 项目 | Wiki `projects/<slug>/index.md` | 盘古 `list_user_projects`；TE `list_projects`（映射 te_id） |
| L2 `channel_platform` | registry 绑定 | TE `list_properties(projectId, scope=user, query=platform)` |
| L2 `package` 等 | registry `enum_source` | 盘古 `get_dimension_info(name=…)` |
| L2 `area_id` | registry pin 列表 | 一般 Wiki；全量可选 TE `list_tags` |

**澄清阶段**可用上述 MCP；**跑数阶段**仍须 Guided builder，禁止用 `list_events` / `list_properties` 作 builder fallback（见 [te-analysis-policy](/synthesis/te-analysis-policy.md)）。

# Filter Slot 规范

每个 slot 在项目 registry 中登记：

| 字段 | 说明 |
|------|------|
| `slot_id` | 稳定 id，如 `channel_platform` |
| `binding` | TE/盘古字段路径 |
| `enum_source` | 可选，盘古 enum 大类名 |
| `ab_default` | 该项目 AB 是否默认启用 |
| `conflict_ref` | 可选，open Conflict 链接 |

**禁止**在全局 `semantic/dimensions/platform.md` 写项目渠道值（如 `temperedheroes_cn`）。

# Session Schema（查数前）

```yaml
analysis_session:
  project_slug: <slug>
  previous_project_slug: <slug | null>   # 漂移检测：展示「上轮 vs 本轮」
  pango_project_id: <int>
  te_project_id: <int>
  project_lock_source: user_explicit | inferred | mcp_default
  project_drift_detected: false          # 本轮是否已触发过重选
  filters_stale: false                   # 项目切换后过滤器待重建
  task: query
  metric_or_playbook: <ref>
  time_range:
    mode: custom | previous | recent
    start: "YYYY-MM-DD"
    end: "YYYY-MM-DD"
  filters:
    - slot: <slot_id>
      field: <technical field>
      operator: eq | in | ...
      values: [...]
      status: active | deferred | stale   # stale = 项目漂移后作废
  cohort:                    # 留存/AB 时
    initial_event: ...
    return_event: ...
  confirmed_by_user: false   # 澄清完成置 true
```

`confirmed_by_user: false` 时 **禁止** TE `query_adhoc`。

**项目漂移时**须同时满足：`confirmed_by_user: false`、`filters_stale: true`（或清空 `filters[]`），直至 F-3 复述后用户确认。

# 项目样板

| slug | 中文名 | 盘古 ID | TE ID | Filter Registry |
|------|--------|---------|-------|-----------------|
| temperedheroes | 百炼英雄 | 69 | 101 | [filter-registry](/projects/temperedheroes/filter-registry.md) |
| fingertipff | 指尖战纪 FF | **82** | 249 | [filter-registry](/projects/fingertipff/filter-registry.md) |

全仓操作指南：[multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)

新项目 onboarding：**先建 filter-registry，再 ingest 事件 catalog**。

# Agent 技能

结构化提问话术见技能 [first-turn-templates.md](../../../.cursor/skills/th-bi-analytics-assistant/references/first-turn-templates.md) **模板 F-1～F-4**；执行流程见 [multi-project-query-clarification.md](../../../.cursor/skills/th-bi-analytics-assistant/references/multi-project-query-clarification.md)。

# Citations

[1] [temperedheroes-platform-filter Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)
[2] [guardrails](/synthesis/temperedheroes-analytics-guardrails.md)
