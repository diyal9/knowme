# Conflicts

口径争议须显式记录，**status: open** 时不得被其他页作为唯一事实依据。裁定流程见 [Conflict 裁定 Checklist](/synthesis/conflict-resolution-checklist.md)。

| 争议 | 状态 | 项目侧记 |
|------|------|----------|
| [D1/D7 cohort — 行业 vs Wiki](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) | open | 百炼/FF 均倾向 `t_register` cohort → 各项目 metric-implementation |
| [DNU 公式 — 行业手册疑似笔误](/synthesis/conflicts/dnu-formula-industry-vs-standard.md) | open | 无 DNU Metric；仅影响行业 glossary 引用 |
| [百炼 AB — platform vs area_id](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md) | open | 百炼 AB 跑数以 **area_id** 为准 |
| [FF area_opr vs 百炼 area_id](/synthesis/conflicts/fingertipff-area-opr-vs-area-id.md) | open | FF 用 **area_opr/server_id**；禁止跨项目复用 area_id |

## 模板

新建 `synthesis/conflicts/{slug}.md`：

```yaml
---
type: Conflict
title: …
status: open
parties: [Wiki, MCP, 用户陈述]
timestamp: …
---
```

裁定后更新 `status: resolved` 与 `resolution`，并修订相关 Metric/Event 页。
