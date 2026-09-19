---
type: Reference
title: 指尖战纪 FF — Filter Slot 注册表
description: 业务口语「平台/渠道/区服」→ TE 字段绑定；与百炼字段名差异须隔离。
tags: [fingertipff, filter, platform, channel, clarification]
project_id: 82
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 说明

**适用范围**：仅 `project_slug=fingertipff`（盘古 **82** / TE **249**）。Session 项目漂移后须重读本页。

**与百炼差异（P0）**：FF **无** 事件属性 `area_id`；区服相关过滤优先 **`server_id`**（`t_register`/`t_login`/`t_pay_flow` 已确认）；`area_opr` 在 TE 存在但 TE 显示名为「行为类型」且**未必挂在核心事件上** — 过滤前须按事件 `list_properties` 核验。**禁止**从百炼 Session 沿用 `area_id` 列表。

对照 canonical：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

全局抽象维度见 [Platform](/semantic/dimensions/platform.md)；**FF 生产过滤以本页为准**。

# Filter Slot 表

| slot_id | 业务说法 | 技术绑定 | TE | 默认用于 AB |
|---------|----------|----------|-----|-------------|
| `channel_platform` | 发行渠道、平台包 | 用户属性 **`platform`** | propId **575516** · string | 须用户确认后启用；**勿用**百炼 `temperedheroes_cn` |
| `event_platform` | 事件上报 platform | 事件属性 **`platform`** | propId **575229** · string | 一般不用 AB |
| `client_os` | iOS、安卓、分端 | 事件 **`os`** | propId **575239** | 否 |
| `package` | 渠道包 | 事件 **`package`** | propId **575238** · **number** | 否 |
| `server_id` | 服务器 ID | 事件 **`server_id`** | propId **575243** · number | 视实验设计 |
| `area_opr` | 区服操作/区服维度 | 事件 **`area_opr`** | propId **579396** · number | 视实验设计 |
| `ad_channel` | 广告渠道 | 事件 **`ad_channel`** | propId **579398** | 否 |

> **不存在** `area_id` slot（百炼专用字段名）。若用户说「区服」→ 澄清 **D** `area_opr` 或 **E** `server_id`。

# 口语 → Slot 映射

| 用户原话 | 优先澄清为 slot | 备注 |
|----------|-----------------|------|
| 「平台」单独出现 | **必问** A/B/C/D/E（见下） | 歧义最高 |
| 「iOS / 安卓」 | `client_os` | 不是 channel_platform |
| 「区服 / 服」 | `area_opr` 或 `server_id` | **勿**映射为 `area_id` |
| 「渠道包」 | `package` | 类型为 number |
| 「广告渠道」 | `ad_channel` | |

## 平台消歧五选一（模板 F-2 · FF 版）

- **A** 发行渠道（用户属性 `platform`）
- **B** 客户端 OS（`os`）
- **C** 渠道包（`package`）
- **D** 区服维度（`area_opr`）
- **E** 服务器（`server_id`）

未选择 → **禁止 TE 查数**。

# 场景默认过滤器

## 全项目 DAU / 留存（无 AB）

| 项 | 规则 |
|----|------|
| 默认 | 无 channel 过滤，除非用户指定 slot |
| 分端 | 用户选 `client_os` 后加 `os` |
| 区服 | 须用户明确 `area_opr` 或 `server_id` 及枚举值（MCP/TE 现查） |

## AB / 区服实验（待 Playbook）

| 项 | 规则 |
|----|------|
| 状态 | **无已文档化 AB Playbook** |
| 临时规则 | 区服类过滤须用户书面列出 `area_opr` / `server_id` 取值 |
| Conflict | [area_opr vs 百炼 area_id](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md) |

# Session 过滤器示例

```yaml
project_slug: fingertipff
te_project_id: 249
filters:
  - slot: client_os
    field: os
    operator: eq
    values: ["iOS"]
    status: active
confirmed_by_user: true
```

# 相关

- [metric-implementation](/projects/fingertipff/metric-implementation.md)
- [guardrails](/synthesis/fingertipff-analytics-guardrails.md)
- [多项目澄清策略](/synthesis/multi-project-filter-clarification-policy.md)
- [百炼 filter-registry](/projects/temperedheroes/filter-registry.md)（**勿跨项目复制**）

# Citations

[1] TE MCP `list_properties` projectId=249（2026-07-10）
[2] [fingertipff-area-opr-vs-area-id Conflict](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md)
