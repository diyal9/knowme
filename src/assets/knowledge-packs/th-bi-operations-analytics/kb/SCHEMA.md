# OKF 扩展约定（th-BI v0.1）

本仓库 OKF Bundle 位于 `kb/okf/`，遵循 [Open Knowledge Format v0.1](https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/main/okf/SPEC.md)，并扩展以下约定。

## 1. Bundle 标识

- **OKF 版本**：`0.1`（在根 `kb/okf/index.md` 声明 `okf_version: "0.1"`）
- **Bundle 名称**：`th-bi-ops-analytics`
- **链接形式**：优先使用 bundle 根相对路径，如 `/semantic/metrics/dau.md`

## 2. Concept type 注册表（团队内约定）

| type             | 层级  | 目录                              | 说明          |
| ---------------- | --- | ------------------------------- | ----------- |
| `Metric`         | 语义  | `semantic/metrics/`             | 指标定义与口径     |
| `Dimension`      | 语义  | `semantic/dimensions/`          | 分析维度        |
| `Segment`        | 语义  | `semantic/segments/`            | 用户分群        |
| `Playbook`       | 语义  | `semantic/playbooks/`           | 分析 SOP      |
| `Tracking Event` | 行为  | `behavioral/events/`            | 埋点元事件       |
| `Event Property` | 行为  | `behavioral/events/properties/` | 事件属性        |
| `Data Table`     | 行为  | `behavioral/tables/`            | 数仓表         |
| `Query Template` | 行为  | `behavioral/queries/`           | 可复用 SQL     |
| `Pipeline`       | 行为  | `behavioral/pipelines/`         | 采集→聚合链路     |
| `Reference`      | 通用  | `references/`                   | 外部权威文档镜像    |
| `Conflict`       | 合成  | `synthesis/conflicts/`          | 口径争议        |
| `Synthesis`      | 合成  | `synthesis/`                    | FAQ、对比、探索结论 |

消费者 MUST 容忍未知 type，按通用 Concept 处理。

## 3. 扩展 frontmatter 字段

除 OKF 必填 `type` 与推荐字段外，本仓常用扩展：

### 3.1 通用

| 字段 | 类型 | 说明 |
|------|------|------|
| `project_id` | string / number | 盘古项目 ID（多项目时） |
| `owner` | string | 口径负责人或团队 |
| `status` | string | `draft` / `active` / `deprecated` / `open`（Conflict） |
| `okf_version` | string | 仅根 index 使用 |

### 3.2 Metric

| 字段 | 说明 |
|------|------|
| `formula` | 口径公式（人类可读） |
| `grain` | 统计粒度，如 `user_id + date` |
| `implemented_by` | 链接列表 → Event |
| `aggregated_from` | 链接列表 → Table |
| `dimensions` | 链接列表 → Dimension |
| `te_query_builder` | （可选）TE Guided builder 名，如 `build_retention_analysis_qp` |
| `te_model_type` | （可选）`query_adhoc` 的 modelType：`event` / `retention` / `funnel` / `prop_analysis` |
| `te_retention_unit_num` | （可选）留存 `unitNum`，如 D7 → `7` |

### 3.3 Tracking Event

| 字段 | 说明 |
|------|------|
| `event_name` | 元事件名（与数据中心一致） |
| `properties` | 链接列表 → Event Property |
| `lands_in` | 链接列表 → Data Table |
| `used_by_metrics` | 链接列表 → Metric |

### 3.4 Data Table

| 字段 | 说明 |
|------|------|
| `resource` | 表 URI 或 `project.dataset.table` |
| `layer` | `ods` / `dwd` / `dws` / `ads` / `dim` |

### 3.5 Dimension

| 字段 | 说明 |
|------|------|
| `enum_source` | 数据中心枚举大类或配置来源 |
| `bi_field` | BI / 数仓中的字段名 |

### 3.6 Conflict

| 字段 | 说明 |
|------|------|
| `status` | `open` / `resolved` |
| `parties` | 冲突各方简述 |
| `resolution` | 裁定结论（resolved 时必填） |

## 4. 推荐 Body 章节

| 标题 | 适用 type |
|------|-----------|
| `# Definition` | Metric, Dimension, Segment |
| `# TE Query Hint` | Metric（已接 TE MCP 的核心 KPI） |
| `# Schema` | Event, Table, Property |
| `# Edge Cases` | Metric, Event |
| `# Joins` | Table, Query |
| `# Steps` | Playbook |
| `# Examples` | 全部 |
| `# Citations` | 全部（外部来源） |

## 5. 链接规则

1. **Metric ↔ Event ↔ Table** 必须双向维护（ingest 时检查）
2. **raw 归档**须符合 [raw-archive-layout.md](../../info/conventions/raw-archive-layout.md)；ingest 映射见该文档 §4
3. 跨项目概念放在 `projects/<slug>/` 或在 frontmatter 标 `project_id`
4. 引用 th-config 渠道/区服约定时使用 `resource` 或 Citations 外链，不在本仓复制配表数值

## 6. index.md 与 log.md

- 每级目录 SHOULD 有 `index.md`（无 frontmatter，OKF §6）
- 根 `log.md` 记录 ingest / query-as-knowledge / lint（OKF §7）
- log 条目前缀建议：`## [YYYY-MM-DD] ingest | …` 便于 grep

## 7. Conformance 自检

Bundle 合格条件：

1. 每个非 reserved `.md` 有 YAML frontmatter 且含非空 `type`
2. 核心 Metric（DAU、留存、付费等）有行为层链接或显式 `status: draft` 说明
3. open Conflict 不得被其他页作为唯一口径依据

Lint 流程见 [info/conventions/okf-kb-operations.md](../info/conventions/okf-kb-operations.md)。
