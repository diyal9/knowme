# Skill 升格流程

当团队反复遇到同类问题时，将经验沉淀为可复用 Skill。

## 触发条件（满足任一）

1. `brain/memory/issues/<category>/` 中同类问题 ≥3 条
2. QA 报告中「建议沉淀」项被 Producer 批准
3. Code Review 中同一类意见出现 ≥2 次

## RED-GREEN-REFACTOR

### RED — 基线

1. 记录当前 Agent 在无 Skill 时的错误行为
2. 保存到 `team/evolution/cases/<topic>-baseline.md`

### GREEN — 写 Skill

1. 创建 `.cursor/skills/team-learned-<topic>/SKILL.md`
2. `description` 以 "Use when..." 开头，只写触发条件
3. 正文：Overview → When to Use → When NOT to Use → Workflow

### REFACTOR — 验证

1. 相同压力场景重跑
2. 更新 `brain/knowledge/processes/team-skills.md`
3. 更新 `brain/knowledge/log.md`

## 命名

```
team-learned-<category>-<short-topic>
```

## 知识沉淀

升格同时 `/kb-ingest` 写入 OKF：
- `brain/knowledge/processes/` — 流程
- `brain/wiki/concepts/` — 领域综合

## 审批

| 步骤 | 审批人 |
|------|--------|
| 提议 | QA 或开发 |
| 批准 | 制作人 |
| 导出分享 | 制作人 + `kb:export` |

## 退役

90 天未触发 → 移至 `team/evolution/retired/`，knowledge 中标注 deprecated
