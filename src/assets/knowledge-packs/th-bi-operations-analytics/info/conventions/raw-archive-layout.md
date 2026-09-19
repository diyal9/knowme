# Raw 原始资料归档规范（Canonical）

**版本**：1.0  
**状态**：全仓强制约定 — 所有智能体、人工归档须遵守。

本文档定义 `raw/` 目录的**唯一合法结构**。原始资料按编号分区存放；Agent **只读**正文，ingest 时编译进 `kb/okf/`。

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **编号分区** | 顶层以 `10-`～`80-` 前缀排序，一眼可见资料层级 |
| **只读存档** | `raw/` 是 source of truth 原文；Agent 不得改写正文 |
| **规范先行** | 各区的 `conventions/` 子目录放**团队规范**；业务案例放同级业务目录 |
| **ingest 导向** | 归档路径决定 ingest 时写入 OKF 的 Concept 类型（见 §4） |

## 2. 完整目录树

```
raw/
├─ README.md
├─ sources-index.md                 # 资料清单（Agent 可更新清单行）
├─ 10-data-basic-knowledge/         # 数据分析基础常识
│  ├─ conventions/
│  │  ├─ da-term-standard/          # 业务统一术语词典
│  │  ├─ da-index-standard/         # 全局指标口径字典
│  │  ├─ data-unit-calibration/     # 统计单位、计算口径统一规范
│  │  └─ report-naming-rules/       # 报表/文件统一命名规范
│  ├─ data-basic-theory/            # 漏斗、AARRR、用户生命周期等
│  ├─ common-statistics-knowledge/  # 转化率、方差、样本量、显著性入门
│  ├─ common-metric-explanation/    # 高频指标通俗解读
│  ├─ business-glossary/            # 行业专属业务名词
│  └─ README.md
├─ 20-data-business-analysis/       # 核心业务分析
│  ├─ conventions/
│  │  ├─ da-sql-write-rules/        # 简易取数 SQL 规范
│  │  ├─ data-demand-template/      # 数据需求提报/评审模板
│  │  ├─ report-output-spec/        # 周/月/专项报告输出格式
│  │  ├─ data-ab-test-simple/       # AB 实验浅层分析流程
│  │  └─ exception-analysis-rules/  # 数据异常排查基础流程
│  ├─ business-module-analysis/
│  │  ├─ user-retention-analysis/   # 留存、流失
│  │  ├─ pay-revenue-analysis/      # 付费、营收、ARPU
│  │  ├─ channel-traffic-analysis/  # 渠道、流量 ROI
│  │  ├─ user-layering-case/        # 用户分层、画像
│  │  ├─ activity-data-analysis/    # 活动效果复盘
│  │  └─ commodity-analysis/        # 商品/道具分析
│  ├─ guilds/                       # 小组沉淀案例库
│  ├─ prd/                          # PRD 配套埋点、指标附表
│  ├─ demand-case-library/          # 历史数据需求存档
│  ├─ exception-case-library/       # 历史异常复盘
│  └─ README.md
├─ 30-data-public-material/           # 全局公共共享素材
│  ├─ common-dictionary/            # 公共埋点字典、基础维表说明
│  ├─ general-index-library/        # 通用全局指标汇总
│  ├─ history-report-library/       # 历史周期性报表存档
│  ├─ public-sql-snippets/           # 通用取数 SQL 片段
│  └─ README.md
├─ 40-da-team-conventions/          # 分析师团队工作规范
│  ├─ data-report-review-standard/
│  ├─ document-manage-rules/
│  └─ README.md
├─ 50-data-training-material/       # 内部培训素材
│  ├─ new-da-training/
│  ├─ skill-sharing-record/
│  ├─ common-problem-qa/
│  └─ README.md
├─ 60-data-analysis-output-library/ # 完整分析报告成品
│  ├─ weekly-monthly-report/
│  ├─ special-topic-report/
│  ├─ ab-test-report-library/
│  ├─ business-proposal-data/
│  └─ README.md
├─ 70-data-collaboration-material/  # 跨部门协作文档
│  ├─ biz-communication-template/
│  ├─ product-data-cooperation/
│  ├─ operation-data-output/
│  └─ README.md
└─ 80-data-history-archive/         # 历史归档封存
   ├─ expired-index-record/         # 下线废弃指标
   ├─ offline-report-backup/         # 停用旧报表
   ├─ old-business-data-case/        # 下线业务案例
   └─ README.md
```

## 3. 分区说明

| 编号 | 目录 | 放什么 | 不放什么 |
|------|------|--------|----------|
| 10 | 基础常识 | 术语、指标字典、统计入门、命名规范 | 具体项目 SQL、成品报告 |
| 20 | 业务分析 | 分模块案例、需求存档、异常复盘、PRD 附表 | 已废弃且未移入 80 的内容 |
| 30 | 公共素材 | 埋点字典、维表、通用指标表、SQL 片段 | 单人草稿、未评审规范 |
| 40 | 团队规范 | 审核标准、文档版本管理 | 业务分析结论 |
| 50 | 培训素材 | 新人课件、分享记录、FAQ | 对外机密未脱敏材料 |
| 60 | 报告成品 | 周月报、专项报告、AB 报告、提案数据 | 进行中的半成品（放 20） |
| 70 | 跨部门协作 | 与产品/运营/业务的模板与对齐文档 | 纯内部分析师笔记 |
| 80 | 历史归档 | 下线指标、旧报表、旧业务案例 | **活跃**仍在用的规范与指标 |

## 4. Ingest → OKF 映射（Agent 必遵）

| raw 路径模式 | 优先写入 OKF |
|--------------|--------------|
| `10-.../conventions/da-index-standard/` | `semantic/metrics/`、`semantic/dimensions/` |
| `10-.../conventions/da-term-standard/`、`business-glossary/` | `semantic/dimensions/`、`references/` |
| `10-.../data-basic-theory/`、`common-metric-explanation/` | `semantic/playbooks/`、`synthesis/` |
| `20-.../conventions/da-sql-write-rules/` | `behavioral/queries/`（规范节）+ `references/` |
| `20-.../business-module-analysis/*/` | `semantic/playbooks/` + `synthesis/` |
| `20-.../prd/` | `behavioral/events/` + `semantic/metrics/` |
| `30-.../common-dictionary/` | `behavioral/events/`、`semantic/dimensions/` |
| `30-.../public-sql-snippets/` | `behavioral/queries/` |
| `30-.../general-index-library/` | `semantic/metrics/` |
| `60-.../*/` | `synthesis/`（结论摘要）+ 链接 Metric/Event |
| `80-.../expired-index-record/` | `semantic/metrics/` 标 `status: deprecated` + Conflict 若与 Wiki 活跃口径冲突 |

**禁止**：将 raw 正文复制进 OKF 后仍不改 frontmatter 链接；ingest 须双向补链（见 [okf-kb-operations.md](./okf-kb-operations.md)）。

## 5. 归档操作规则（人工 + Agent）

### 5.1 新增文件

1. 按 §2 树定位**唯一**目标目录；不得在 `raw/` 根下随意新建未定义文件夹。
2. 文件名遵循 `10-.../conventions/report-naming-rules/` 中的命名规范（若有）。
3. 在 [raw/sources-index.md](../raw/sources-index.md) **追加一行**清单。
4. 触发 Agent ingest，或自行更新 OKF。

### 5.2 下线 / 废弃

- 活跃区**删除**前，先将文件移入 `80-data-history-archive/` 对应子目录。
- 同步 ingest：Wiki Metric 改 `deprecated`；必要时建 [Conflict](../kb/okf/synthesis/conflicts/)。

### 5.3 Agent 约束

- **可读**：`raw/**` 全部
- **可写**：仅 `raw/sources-index.md` 清单行（operator）
- **不可写**：任何 raw 正文文件（含 README 以外的业务文档）

## 6. 与 OKF Wiki 的关系

```
raw/（原文存档，分区规范）
        │ ingest（只读读入）
        ▼
kb/okf/（结构化 Wiki，交叉链接）
        │ query / lint
        ▼
synthesis/、metrics/、events/ …
```

OKF 侧索引：[kb/okf/references/raw-archive-layout.md](../kb/okf/references/raw-archive-layout.md)

## 7. 变更本规范

- 增删顶层编号分区须 **maintainer** 角色 + 团队评审。
- 变更后同步：`info/conventions/raw-archive-layout.md`、本文件、`raw/**/README.md`、`kb/okf/references/raw-archive-layout.md`、`AGENTS.md` 索引。

## 8. 更新日志

| 日期 | 变更 |
|------|------|
| 2026-06-17 | v1.0 初版：10～80 分区树与 ingest 映射 |
