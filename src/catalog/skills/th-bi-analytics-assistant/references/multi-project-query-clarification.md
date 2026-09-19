# 多项目查数 — 结构化澄清

Wiki 策略全文：[multi-project-filter-clarification-policy.md](../../../kb/okf/synthesis/multi-project-filter-clarification-policy.md)

## 触发条件

- 用户要 **具体数字** / TE 查数 / AB 报告
- 或提到 **平台、渠道、微小、区服、分端**

## 流程

0. **L0 漂移检测**（每轮必做）：解析本轮项目信号 → 与 Session `project_slug` 比对 → 不一致则 **模板 F-4 重选**，重置 `confirmed_by_user` 与 `filters[]`，**禁止跑 TE**
1. **L0** 锁定 `project_slug` → 读 `projects/<slug>/index.md` + `filter-registry.md`
2. **L1** 确认 `time_range`（禁止默认近 7 天）+ 指标/Playbook
3. **L2** 若口语含「平台/渠道/区服」→ Slot 消歧（F-2）；枚举值按需 MCP（见下表）
4. **复述** Session 摘要（F-3），获用户确认 → `confirmed_by_user: true`
5. **L3** 读 `metric-implementation.md` → TE builder → `query_adhoc`

## 基础参数 MCP（澄清阶段）

| 层 | 缺什么 | MCP / Wiki |
|----|--------|------------|
| L0 项目 | 未锁项目或漂移 | 盘古 `list_user_projects`；TE `list_projects`；Wiki `projects/<slug>/index.md` 映射双 ID |
| L2 发行渠道 | `channel_platform` 枚举 | TE `list_properties(projectId, scope=user, query=platform)` |
| L2 渠道包等 | registry 有 `enum_source` | 盘古 `get_dimension_info` |
| L2 区服 | AB pin | 优先 Wiki filter-registry；全量可选 TE `list_tags` |

结构化选项优先用 **AskQuestion**（或 F-2/F-4 文本选项）；选项 label 须含 slug + 双 ID（若有）。

## 项目漂移（L0 第 0 步）

```
任意轮次输入
  → resolve_project_hint(用户话 + 上下文)
  → 与 session.project_slug 比较
       ├─ 一致 / 未提及项目 → 继续 L1…
       └─ 不一致或 ambiguous
            → confirmed_by_user = false
            → filters[] 清空或 status: stale
            → F-4 结构化重选项目
            → 禁止 TE / 禁止项目数字
```

同项目延续词：「还是 XX」「同上」「刚才那个项目」→ 不触发漂移。

## 百炼快捷

- Registry：[filter-registry.md](../../../kb/okf/projects/temperedheroes/filter-registry.md)
- AB 默认：**仅 area_id**；`channel_platform` 为 **deferred**（open Conflict）

## FF 快捷

- Registry：[filter-registry.md](../../../kb/okf/projects/fingertipff/filter-registry.md)
- 区服：**`area_opr` / `server_id`**（**无 `area_id`**）
- 金额：**`cost`**（非 `generalcost`）

## 多项目

- 操作指南：[multi-project-operating-guide.md](../../../kb/okf/synthesis/multi-project-operating-guide.md)
- 已接入 slug：`temperedheroes` · `fingertipff`

## 红线

- 未锁项目 → 不给项目数字
- **Session 项目与本轮信号不一致 → 不跑 TE**（须 F-4 重选）
- **项目切换后禁止沿用旧 filters[]**
- 「平台」未消歧 → 不跑 TE
- 不得用全局 LoginEvent 模板名代替项目生产事件名
- 澄清阶段 MCP 拉枚举 ✓；跑数阶段 **禁止** 用 `list_events`/`list_properties` 替代 builder

话术：[first-turn-templates.md](first-turn-templates.md) 模板 F-1～F-4
