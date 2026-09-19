---
type: Reference
title: Raw 原始资料归档规范
description: raw/ 目录 10～80 分区树、ingest 映射与 Agent 只读约束。
resource: /info/conventions/raw-archive-layout.md
tags: [raw, archive, convention, mandatory]
owner: 数据组
status: active
timestamp: 2026-06-17T00:00:00Z
---

# Raw 归档规范

本 Concept 为 OKF 侧入口；**Canonical 全文**见仓库内：

[info/conventions/raw-archive-layout.md](../../../info/conventions/raw-archive-layout.md)

## 强制约束（摘要）

1. 原始资料**仅**允许存入规范树 `raw/10-*` … `raw/80-*`
2. Agent **只读** raw 正文；**可写** `raw/sources-index.md` 清单
3. ingest 须按规范 §4 映射写入 OKF（Metric / Event / Playbook / Query / synthesis）
4. 下线内容移入 `80-data-history-archive/`，Wiki 标 `deprecated`

## 顶层分区

| 编号 | 目录 |
|------|------|
| 10 | 数据分析基础常识 |
| 20 | 核心业务分析 |
| 30 | 全局公共素材 |
| 40 | 分析师团队规范 |
| 50 | 培训素材 |
| 60 | 分析报告成品 |
| 70 | 跨部门协作 |
| 80 | 历史归档 |

## Citations

[1] [info/conventions/raw-archive-layout.md](../../../info/conventions/raw-archive-layout.md) — v1.0 Canonical
