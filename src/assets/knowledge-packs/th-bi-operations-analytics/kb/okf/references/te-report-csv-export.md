---
type: Reference
title: TE 报表 CSV 导出（与页面导出一致）
description: 无 TE 导出 API 时的可行路径；query_report_data 能力边界；Playwright / API 复放 / 本地 CSV。
tags: [te-mcp, export, csv, retention, report, playwright]
status: active
owner: 数据组
mcp_server: user-te-mcp-analysis
timestamp: 2026-06-23T18:00:00Z
---

# 目标

字段对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

Agent 需要与 BI 页面「导出」按钮下载的 CSV **一致**（样例：reportId **86037**，[留存报表链接](https://bi.forevernine.net/#/tga/retention/2_86037?fromPanel=2_10790)）。

# 约束：TE 为外部服务，无法新增 MCP 接口

`user-te-mcp-analysis` **没有** `export_report_csv`，且对方不能加接口。  
`query_report_data` **不能**替代页面导出（见下表）。

| 维度 | 页面导出 | `query_report_data` |
|------|----------|---------------------|
| 月度行 `2025-04月` | ✅（`collectType=month`） | ❌ 不返回 |
| 行数 | 样例 193 | 上限 **100** |
| 阶段汇总 12 行 | ✅ | ✅ **可 100% 对齐**（同时间窗） |
| `timeGranularity=month` | — | ❌ 列变成「3**月**」非「3**日**」，语义不同 |

# 可行方案（按推荐顺序）

## 方案 A — 用户提供已导出 CSV（零开发，分析最稳）

1. 用户在 BI 页面点「导出」，得到如 `源-首日付费留存-TH国内-TSA混跑_20250422-20260622.csv`
2. Agent **只读**本地文件做解读、对比、入库摘要
3. 适合：一次性分析、口径已固定的留存报表

**优点**：与页面 100% 一致；无登录/automation 维护。  
**缺点**：不能全自动拉数。

## 方案 B — Playwright 模拟页面导出（全自动且与页面一致）

**权威实现**：技能 [`.cursor/skills/te-report-playwright-export`](../../../.cursor/skills/te-report-playwright-export/SKILL.md)

- 输入：TE 报表 URL，或飞书文档内嵌的 `bi.forevernine.net` 链接
- 流程：`check_te_login` → `save_te_storage_state`（未登录）→ `export_te_report_csv`（无头点击「导出」）
- 无导出按钮 → exit 20，提示用户（附截图），**禁止**用 MCP 拼表替代

**优点**：字节级与页面导出一致。  
**缺点**：UI 选择器随版本变化需维护；需先保存 TE `storage_state`；适合「报表 URL 固定、重复导出」。

旧骨架脚本（仅供参考）：[tools/te_bi_playwright_export.py](./tools/te_bi_playwright_export.py)

## 方案 C — 录制并复放前端导出 HTTP（半自动）

1. 浏览器 DevTools / Playwright `browser_network_requests`：在点「导出」时录制 **export** 请求（URL、method、body、鉴权头/cookie）
2. 本地 Python `requests` 脚本按相同参数请求，保存响应为 CSV
3. 鉴权：与 MCP 共用 cookie 或定期刷新 token（需内部文档或一次性抓包）

**优点**：比 UI 点击稳定；可 cron。  
**缺点**：首次需抓包；token 过期要续期；接口未公开则属「逆向」，需团队合规确认。

## 方案 D — MCP 部分导出（仅阶段汇总）

[tools/te_report_to_csv.py](./tools/te_report_to_csv.py) + `get_report_definition` + `query_report_data`（带 `startDate`/`endDate`）

- 输出：**表头 + 12 行阶段汇总**（已用 86037 验收一致）
- **不含**月度明细（181 行）

**优点**：纯 MCP、可 Agent 自动跑。  
**缺点**：**不能**冒充完整页面 CSV；须向用户说明缺失月度块。

## 方案 E — `build_retention_analysis_qp` 重跑（不推荐用于「与某报表导出一致」）

即用席留存可接近业务口径，但很难与**已保存报表**（标签版本、复合筛选、`collectFirstDay` 等）逐列一致，**不作为**页面 CSV 的替代。

# 推荐组合

| 场景 | 做法 |
|------|------|
| 用户已给 CSV / 本地 Downloads | **方案 A** |
| Agent 定期拉同一报表全量 CSV | **方案 B** 或 **方案 C** |
| 只要总览留存、不要分月 | **方案 D** |
| 要完整 CSV 且不能自动化 | **方案 A** + 说明 |

# 本地脚本

| 文件 | 用途 |
|------|------|
| [te_report_to_csv.py](./tools/te_report_to_csv.py) | MCP JSON → CSV（阶段汇总 + 列投影；有月度行时可拼全表） |
| `.cursor/skills/te-report-playwright-export/scripts/` | **Playwright 无头导出**（与页面「导出」一致；见技能 SKILL.md） |
| [te_bi_playwright_export.py](./tools/te_bi_playwright_export.py) | 早期骨架，已由技能脚本取代 |

# Agent 话术

- 用户要「和导出按钮一样」→ 优先 **A 或 B**；勿声称 `query_report_data` 已等价导出。
- 用户只给报表 URL → 可 MCP 读**阶段汇总**预览；全量 CSV 请导出文件或授权 Playwright。

# 相关

- [te-mcp-analysis.md](./te-mcp-analysis.md)

# Citations

[1] 参考 CSV `源-首日付费留存-TH国内-TSA混跑_20250422-20260622.csv`（用户本地）
[2] MCP 对比：阶段 12/12 一致；月度行缺失（2026-06-23）
