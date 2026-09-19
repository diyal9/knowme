# th-BI 运营分析知识库 — 架构方案

本文档为 **th-BI 仓库知识库建设的 canonical 方案**，与根目录 [AGENTS.md](../AGENTS.md)、[kb/SCHEMA.md](./SCHEMA.md) 及 `.cursor/skills/th-bi-analytics-assistant/` 配套使用。

## 1. 背景与目标

本仓库服务于**手机游戏公司运营数据分析**智能体协作，目标：

- **提高数据分析能力**：可复用的 Playbook、SQL 模板、指标定义
- **提高智能化程度**：Agent 维护的持久 Wiki，而非每次 RAG 重发现
- **提高数据准确性**：语义层与行为层双向链接，口径冲突显式记录

## 2. 设计原则：LLM Wiki + OKF

参考 [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 与 [Google OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)：

| Karpathy 三层 | 本仓路径 | 职责 |
|---------------|----------|------|
| Raw sources | `raw/` | 只读原始资料（**10～80 分区**，见 [raw-archive-layout.md](../info/conventions/raw-archive-layout.md)） |
| Wiki | `kb/okf/` | Agent 维护的 OKF Bundle |
| Schema | `AGENTS.md`、`kb/SCHEMA.md`、技能包 | ingest / query / lint 约定 |

**关键差异（相对普通 RAG）**：知识被**编译一次并保持更新**；交叉引用、口径争议、合成结论已沉淀在 Wiki 中，Agent 查询时沿链接展开，而非每次从零检索碎片。

## 3. 语义层 vs 行为层

手游运营分析最常见的口径错误来自两层脱节：

```
语义层（业务怎么说）          行为层（数据怎么来）
─────────────────          ─────────────────
Metric  指标               Tracking Event  埋点事件
Dimension  维度            Event Property  事件属性
Segment  用户分群           Data Table  数仓表
Playbook  分析套路          Query Template  SQL 模板
                           Pipeline  数据管道
```

**打通方式**：OKF 交叉链接 + frontmatter 机器可读字段（`implemented_by`、`lands_in`、`used_by_metrics` 等）。每个 Metric 必须链接到实现它的 Event(s) 与聚合 Table(s)；每个 Event 必须链接到落库 Table 与被引用的 Metric(s)。

## 4. 目录结构

```
th-BI/
├── AGENTS.md
├── kb/
│   ├── ARCHITECTURE.md          # 本文件
│   ├── SCHEMA.md                # OKF 扩展约定
│   └── okf/                     # 主 Bundle
│       ├── index.md
│       ├── log.md
│       ├── semantic/            # 语义层
│       │   ├── metrics/
│       │   ├── dimensions/
│       │   ├── segments/
│       │   └── playbooks/
│       ├── behavioral/          # 行为层
│       │   ├── events/
│       │   ├── tables/
│       │   ├── pipelines/
│       │   └── queries/
│       ├── projects/            # 按游戏/项目分域
│       ├── references/          # 外部文档镜像
│       └── synthesis/           # 综合页、FAQ、口径争议
├── raw/                         # 只读原始资料（10～80 分区）
│   ├── 10-data-basic-knowledge/
│   ├── 20-data-business-analysis/
│   ├── … 30～80 …
│   └── README.md
└── .cursor/skills/              # Agent 技能包
```

## 5. OKF Concept 类型（本仓扩展）

详见 [SCHEMA.md](./SCHEMA.md)。核心 type：

| type | 层级 |
|------|------|
| Metric, Dimension, Segment, Playbook | 语义 |
| Tracking Event, Event Property, Data Table, Query Template, Pipeline | 行为 |
| Reference, Conflict, Synthesis | 通用 / 合成 |

## 6. 三类核心操作

### 6.1 Ingest（入库）

**触发**：新埋点上线、报表变更、复盘纪要、口径讨论。

**流程**：

1. 原始资料放入 `raw/`（Agent 不改写 raw 正文）
2. Agent 读取 raw，与用户确认要点
3. 更新 `kb/okf/`：新建/更新 Concept，**双向补链**
4. 发现口径冲突 → `synthesis/conflicts/`，`status: open`
5. 更新各级 `index.md` 与根 `log.md`
6. 可选：盘古 MCP 校验（`list_events`、`list_dimensions`、`get_requirement_buried_point`）

### 6.2 Query（问答）

1. 读 `kb/okf/index.md`（渐进式披露）
2. 沿链接展开 3–5 个 Concept，合成答案
3. **好答案写回** `kb/okf/synthesis/`（比较表、分析结论、新 Playbook）

### 6.3 Lint（健康检查）

- Metric 无 `implemented_by` / `aggregated_from` → 语义悬空
- Event 无 `lands_in` → 行为悬空
- `Conflict` 仍为 open 但被其他页引用为事实
- 孤儿页（无入链）
- Wiki 与 MCP 实时数据不一致
- Wiki Event 名与 TE `list_events` 不一致（有 projectId 时）

## 7. 权威来源与冲突

| 问题类型 | 权威 |
|----------|------|
| 埋点 / 枚举 | 盘古数据中心 MCP |
| 指标口径 / Playbook | OKF Wiki |
| 即席分析 / 报表数值 | TE 分析 MCP `user-te-mcp-analysis` |
| 长文档全文 | Cherry KB / RAGFlow |
| 配表数值 | th-config 仓库 |

三者不一致 → **并列差异，请用户确认**（见 [info/conventions/authority-and-conflicts.md](../info/conventions/authority-and-conflicts.md)）。

## 8. 与现有基础设施集成

| 能力 | 用途 |
|------|------|
| 盘古 MCP | Ingest 校验行为层；Lint diff |
| TE 分析 MCP | Guided 查数（`build_*_qp` → `query_adhoc`）；Wiki [te-mcp-analysis](/okf/references/te-mcp-analysis.md) |
| Cherry KB MCP | Wiki 规模化后的向量检索补充 |
| OKF visualize | 生成 `viz.html` 关系图（可选） |
| th-config | 配表、渠道/区服维度共识交叉引用 |

## 9. 分阶段落地

| 阶段 | 内容 |
|------|------|
| Phase 0 | 骨架 + 核心 Concept 模板（**当前**） |
| Phase 1 | MCP 自动 ingest 草稿 + Lint |
| Phase 2 | Playbooks + queries 沉淀 + 混合检索 |
| Phase 3 | visualize + PR Review 口径治理 |

## 10. 参考链接

- [Karpathy LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [OKF README](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
- [OKF SPEC v0.1](https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/main/okf/SPEC.md)
