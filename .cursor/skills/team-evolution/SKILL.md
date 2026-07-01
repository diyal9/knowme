---
name: team-evolution
description: >-
  Use when the same defect recurs ≥3 times, promoting learnings to a new Skill,
  or running the self-evolution loop after story-done for StickyNotes.
---

# 团队自我进化

流程：`team/evolution/skill-promotion.md`  
知识循环：`brain/knowledge/processes/evolution-loop.md`

## 触发

1. `brain/memory/issues/` 同类问题 ≥3 条
2. Hook `patterns/pending_prompts.jsonl`（`sticky-agent-memory`）
3. QA test-report「建议沉淀」+ Producer 批准
4. `/story-done` 后的回顾中发现可复用模式

## 与 sticky-agent-memory

- Hook 自动采集个人记忆 → 用户确认 → `/kb-ingest` 升团队 OKF
- pending 队列按 `sticky-agent-memory/references/promotion.md` 询问用户

## 循环

```
Capture (memory) → Ingest (wiki/knowledge) → Lint → Promote (skill) → Export (share)
```

## RED-GREEN-REFACTOR

### RED

记录无 Skill 时的失败 → `team/evolution/cases/<topic>-baseline.md`

### GREEN

创建 `.cursor/skills/team-learned-<topic>/SKILL.md`：

```yaml
---
name: team-learned-<category>-<topic>
description: Use when <触发场景，第三人称>
---
```

### REFACTOR

重跑场景验证；更新 `brain/knowledge/processes/team-skills.md` + `log.md`

## 审批

- 提议：QA 或开发
- 批准：**制作人**
- 合并：记入 knowledge log

## 分享

进化后的 OKF bundle：`npm run kb:export` → 给其他 StickyNotes 用户 `kb:import`
