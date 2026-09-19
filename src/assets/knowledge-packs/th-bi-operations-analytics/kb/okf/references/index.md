# References

外部权威文档的 OKF 镜像或摘要，type 使用 `Reference`。

* [Raw 归档规范](/references/raw-archive-layout.md) — raw/ 10～80 分区与 ingest 映射（**强制**）
* [行业术语手册](/references/industry-glossary/) — 345 条行业参考（非团队强制口径）
* [TE 分析 MCP](/references/te-mcp-analysis.md) — Guided 查数与 Metric 映射
* [盘古埋点枚举](/references/pango-dimensions/) — 数据中心枚举 L1 大类目录

## 与 raw/ 的关系

- `raw/` 存**完整原始文件**（只读）
- `references/` 存 Agent 提炼的**可链接 Concept**（可写）
