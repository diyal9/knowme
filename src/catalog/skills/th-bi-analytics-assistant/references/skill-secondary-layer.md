# 技能第二层：目标、双轨与 Wiki 入口

## 1. 本技能目标

- 维护 **OKF Wiki**（`kb/okf/`），打通语义层与行为层
- 支持 **ingest / query / lint** 三类操作
- 与 **盘古 MCP** 对齐埋点权威；与 **th-config** 边界清晰

## 2. 三轨裁决

| 轨道 | 来源 | 适用 |
|------|------|------|
| 结构化 Wiki | `kb/okf/` | 口径定义、链接、Playbook |
| 埋点协议 | 盘古 MCP | 元事件、属性、枚举 |
| **查数执行** | TE MCP `user-te-mcp-analysis` | Guided QP → 即席/报表数字 |
| 非结构化 | Cherry KB / RAG | 长文档补充 |

冲突处理见 [authority-and-conflicts.md](authority-and-conflicts.md)、Wiki [te-analysis-policy](../../../../kb/okf/synthesis/te-analysis-policy.md)。

## 3. Wiki 入口（渐进加载）

1. [kb/okf/index.md](../../../../kb/okf/index.md) — 总览
2. 任务相关子 index（`semantic/metrics/`、`behavioral/events/` …）
3. 单个 Concept 全文

勿一次性加载整个 Bundle。

## 4. raw/ 入口

- 结构规范（**强制**）：[info/conventions/raw-archive-layout.md](../../../../info/conventions/raw-archive-layout.md)
- 清单：[raw/sources-index.md](../../../../raw/sources-index.md)
- Agent **只读** raw 正文；ingest 映射见规范 §4

## 5. 与 th-config

配表、Skill.xlsx、活动数值 → 引导 **th-config** 配置助手，不在本仓改 Excel。
