---
okf_version: "0.1"
---

# th-BI 运营分析知识库

手游运营数据分析 OKF Bundle：打通**语义层**与**行为层**。

## 语义层

* [指标 Metrics](semantic/metrics/) — DAU、留存、付费、LTV 等口径
* [维度 Dimensions](semantic/dimensions/) — 渠道、平台、区服、版本等
* [分群 Segments](semantic/segments/) — 新用户、回流、大 R 等
* [分析套路 Playbooks](semantic/playbooks/) — 活动复盘、版本对比、渠道评估

## 行为层

* [埋点事件 Events](behavioral/events/) — 元事件与属性
* [数仓表 Tables](behavioral/tables/) — ODS/DWD/DWS/ADS
* [查询模板 Queries](behavioral/queries/) — 可复用 SQL
* [数据管道 Pipelines](behavioral/pipelines/) — 采集与聚合链路

## 合成与参考

* [综合页 Synthesis](synthesis/) — FAQ、探索结论
* [口径争议 Conflicts](synthesis/conflicts/) — 待裁定差异
* [外部参考 References](references/) — 文档镜像
  * [行业术语手册](references/industry-glossary/) — 345 条行业参考（非团队强制）
  * [TE 分析 MCP](references/te-mcp-analysis.md) — Guided 查数执行轨

## 项目分域

* [按项目 Projects](projects/) — 多游戏时按 slug 隔离

## 导航

* 架构方案：[../ARCHITECTURE.md](../ARCHITECTURE.md)
* OKF 约定：[../SCHEMA.md](../SCHEMA.md)
* **Raw 归档规范（强制）**：[raw-archive-layout.md](raw-archive-layout.md) → [info/conventions/raw-archive-layout.md](../../../info/conventions/raw-archive-layout.md)
* 更新日志：[log.md](log.md)
