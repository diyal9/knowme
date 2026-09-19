---
type: Reference
title: 百炼英雄 — Filter Slot 注册表
description: 业务口语「平台/渠道/区服」→ TE/盘古字段绑定；结构化澄清与查数过滤器依据。
tags: [temperedheroes, filter, platform, channel, clarification]
project_id: 69
te_project_id: 101
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# 说明

**适用范围**：仅 `project_slug=temperedheroes`（盘古 **69** / TE **101**）。Session 项目漂移后须重读本页，**禁止**将本表 slot 用于其他项目。

用户说 **「平台」「渠道」「微小」「区服」** 时，Agent **不得**直接映射到单一字段 `platform`，须按本表 **Filter Slot** 澄清。

全局抽象维度见 [Platform](/semantic/dimensions/platform.md)（客户端 OS）；**百炼生产过滤以本页为准**。

# Filter Slot 表

| slot_id | 业务说法 | 技术绑定 | TE | 盘古枚举 | 默认用于 AB |
|---------|----------|----------|-----|----------|-------------|
| `channel_platform` | 微小、国服渠道、`temperedheroes_cn` | 用户属性 **`platform`** | propId **575530**，desc「平台(注册时)」 | 事件表头也有 `platform`（string） | ⚠️ 待裁定 |
| `event_platform` | 事件上报 platform | 事件属性 **`platform`**（继承 t_default） | event_property | — | 一般不用 AB |
| `client_os` | iOS、安卓、分端 | 事件 **`os`** / 语义 [Platform](/semantic/dimensions/platform.md) | event_property | — | 否 |
| `package` | 渠道包、包体 | 事件 **`package`** | event_property | **PACKAGE_TYPE** | 否 |
| `area_id` | 区服、服、AB 分流 | 事件 **`area_id`**（int） | event_property | — | **✅ 主过滤** |
| `server_id` | 服务器 ID（≠区服） | 事件 **`server_id`**（t_login 专有） | event_property | — | 否 |

# 口语 → Slot 映射（Agent 消歧）

| 用户原话 | 优先澄清为 slot | 备注 |
|----------|-----------------|------|
| 「微小渠道」 | `channel_platform` + 常配合 `area_id` | 值常为 `temperedheroes_cn` |
| 「平台」单独出现 | **必问** A/B/C/D（见下） | 歧义最高 |
| 「iOS / 安卓」 | `client_os` | 不是 channel_platform |
| 「区服 / 实验服」 | `area_id` | AB 核心 |
| 「渠道包」 | `package` | 勿与 platform 混 |

## 平台消歧四选一（模板 F-2）

当用户仅说「平台」且未指定 slot 时，Agent 须展示：

- **A** 发行渠道（用户属性 `platform`，如 `temperedheroes_cn`）
- **B** 客户端 OS（iOS / Android）
- **C** 渠道包（`package` / PACKAGE_TYPE）
- **D** 区服（`area_id`）

未选择 → **禁止 TE 查数**（仅可口径说明）。

# 场景默认过滤器

## 首充 AB 实验（Playbook）

| 项 | 规则 |
|----|------|
| 主过滤 | **`area_id` IN** 实验/对照列表（见 [Segment](/semantic/segments/ab-firstcharge-test.md)） |
| `channel_platform` | **默认不加**（2026-05-27~05-31 窗加 `temperedheroes_cn` 返回 0 样本） |
| Conflict | [platform vs area_id](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md) **open** |
| TE 标签 | 15005 / 15006（可选替代手工 area_id 列表） |

### area_id 列表（pin）

| 组别 | area_id |
|------|---------|
| 实验组 | 9993, 9995, 9997, 9999, 10001, 10003, 10005, 10007, 10009 |
| 对照组 | 9994, 9996, 9998, 10000, 10002, 10004, 10006, 10008, 10010 |

## 全项目 DAU / 留存（无 AB）

| 项 | 规则 |
|----|------|
| 默认 | 无 channel 过滤，除非用户指定 slot |
| 分端 | 用户选 `client_os` 后加 `os` 或 Platform 切片 |
| 微小全量 | 须用户确认 `channel_platform` 实际枚举值（MCP/TE 现查） |

# Session 过滤器示例（YAML）

```yaml
project_slug: temperedheroes
te_project_id: 101
filters:
  - slot: area_id
    field: area_id
    operator: in
    values: [9993, 9995, 9997, 9999, 10001, 10003, 10005, 10007, 10009]
    status: active
  - slot: channel_platform
    field: user.platform
    operator: eq
    values: ["temperedheroes_cn"]
    status: deferred   # open conflict — 未启用
confirmed_by_user: true
```

# 相关

- [metric-implementation](/projects/temperedheroes/metric-implementation.md)
- [guardrails](/synthesis/temperedheroes-analytics-guardrails.md)
- [多项目澄清策略](/synthesis/multi-project-filter-clarification-policy.md)

# Citations

[1] TE MCP list_properties platform scope=user propId=575530（2026-06-18）
[2] 首充 AB 第 1 期报告 + open Conflict（2026-06-17~18）
