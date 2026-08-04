---
type: Playbook
title: Team Self-Evolution Loop
description: How KnowMe agent team compounds knowledge and promotes skills.
tags: [process, evolution, react]
timestamp: 2026-07-01T00:00:00Z
---

# Loop

产品上下文：[Product Overview](/concepts/product-overview.md)

```
Story 完成 → Hook 自动 working + memory 回顾 → /kb-ingest → /kb-lint → 复发≥3 → /evolve → /kb-export
```

个人 episodic：`sticky-agent-memory`（`%LOCALAPPDATA%\knowme\memory\`，不入 git）

## 1. Capture（Observe）

Story `/story-done` 后，在 `brain/memory/working/` 写简短回顾：
- 踩坑、反模式发现、架构决策

## 2. Ingest（Act）

`/kb-ingest` 或 `llm-wiki-maintenance` skill：
- 更新 `brain/wiki/` 综合页
- 新增/修订 `brain/knowledge/` OKF concepts
- 更新 `index.md` + `log.md`

## 3. Lint（Reflect）

`/kb-lint` 检查：schema、孤儿、断链、矛盾、过期

## 4. Promote（Evolve）

见 `team/evolution/skill-promotion.md`：
- `memory/issues/` 同类 ≥3 → `team-learned-*` Skill
- Producer 批准 → 登记 [Team Skills Registry](/processes/team-skills.md)

## 5. Share（Export）

`npm run kb:export` 生成可分享的 OKF zip，其他用户 `kb:import`。

# Related

- [Adopt LLM Wiki + OKF](/decisions/adopt-llm-wiki-okf.md)
- Command: `/evolve`
