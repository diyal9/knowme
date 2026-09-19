---
type: Synthesis
title: 多项目报表导出指南（百炼 + FF）
description: TE 页面 CSV 导出在百炼与 FF 并存时的项目隔离、列名差异、MCP 边界与 Playwright 流程。
tags: [multi-project, export, csv, te, temperedheroes, fingertipff]
status: active
owner: 数据组
timestamp: 2026-07-10T15:30:00Z
---

# 目标

从 [bi.forevernine.net](https://bi.forevernine.net) 导出与页面「导出」按钮**一致**的 CSV，且在 **百炼（TE 101）** 与 **FF（TE 249）** 之间**不串项目**。

字段对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

---

# 1. 通用约束（两项目相同）

权威全文：[te-report-csv-export](/references/te-report-csv-export.md)

| 能力 | 页面导出 | MCP `query_report_data` |
|------|----------|---------------------------|
| 全量行 / 月度行 | ✅ | ❌（上限 100 行；月度语义不同） |
| 与已保存报表逐列一致 | ✅ | ❌ 不可替代 |

**禁止**：用 `query_report_data` 拼 CSV 冒充页面导出。

**自动化**：技能 [te-report-playwright-export](../../../.cursor/skills/te-report-playwright-export/SKILL.md)（项目无关，但 URL 必须对）。

---

# 2. 项目隔离（P0）

| 检查项 | 百炼 | FF |
|--------|------|-----|
| TE `projectId` | **101** | **249** |
| 报表 URL 域名 | `bi.forevernine.net` | 同左 |
| URL 内 project 上下文 | 须为 101 下创建的报表 | 须为 249 下创建的报表 |

**禁止**：

1. 把百炼留存/AB 报表链接直接给 FF 分析
2. 在 FF 会话用 Playwright 导出百炼 URL（或反之）
3. 飞书文档批量导出时不核对每条链接所属项目

**换项目后**：清空本地 manifest / 确认 `output-dir` 文件名含项目标识，避免 CSV 覆盖混淆。

---

# 3. 列名与口径差异（导出 CSV 常见坑）

报表定义中的属性名会直接进入 CSV 表头。跨项目复制报表模板时，下列列**不会**自动对齐：

| 语义 | 百炼 CSV 可能出现 | FF CSV 可能出现 | 后果 |
|------|-------------------|-----------------|------|
| 区服 | `area_id` | `server_id`（或无二选一） | 过滤失效 / 空列 |
| 金额 | `generalcost` | `cost` 或 `#vp@cost_yuan` | ARPU 偏差数量级 |
| 渠道 | `platform`=`temperedheroes_cn` | FF 自有 platform 枚举 | 样本为 0 |
| 礼包 | `gift_pack_id` | `trade_id` / `scene_id` | 首充分档不可比 |

**对策**：每个项目维护独立报表；对照 [field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md) §3–§4 核对表头。

---

# 4. 时区与导出日期

| 项目 | TE 时区配置 | 导出注意 |
|------|-------------|----------|
| 百炼 | offset **+8**，`timeZoneEnabled=true` | 默认业务日 UTC+8 |
| FF | offset **0**，`timeZoneEnabled=false` | 报表「统计日期」可能与 UTC+8 业务日差一天；导出后须核对时间范围 |

同一「2026-07-01」文件名在两项目可能覆盖不同时间窗口。

---

# 5. 已文档化报表入口

## 百炼（TE 101）

| 场景 | 文档 |
|------|------|
| 首充 AB 8 张报表 | [看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)（reportId **87751–87758**） |
| 看板 | **12111** |

## FF（TE 249）

| 场景 | 文档 |
|------|------|
| 核心 KPI 留存 / 活跃 | [FF 核心报表目录](/synthesis/fingertipff-core-reports-catalog.md) |
| 全量 | TE `list_reports` projectId=**249**（142+ 张，按名检索） |

FF **无**百炼式 AB 报表清单；新建报表后应 pin 到 `fingertipff-core-reports-catalog.md`。

---

# 6. 推荐工作流

```
确认 project_slug
  → 在 TE 对应 projectId 下打开报表
  → 核对过滤器字段（filter-registry）
  → 方案 A：人工点导出 / 方案 B：Playwright 技能
  → 解读 CSV 时核对表头与 field-diff
  → 跨项目对比：禁止 merge 前未做字段映射
```

---

# 7. Agent 红线

1. 未锁项目 → 禁止导出或解读 CSV
2. 无导出按钮 → exit 20，**禁止** MCP 拼表
3. 跨项目对比表 → 须显式标注两列各自 projectId 与金额字段
4. FF 金额报「元」→ 确认列名为 `cost` 还是 `#vp@cost_yuan`

---

# Citations

[1] [te-report-csv-export](/references/te-report-csv-export.md)
[2] TE MCP `get_project_config` 101 vs 249（2026-07-10）
[3] [ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)
