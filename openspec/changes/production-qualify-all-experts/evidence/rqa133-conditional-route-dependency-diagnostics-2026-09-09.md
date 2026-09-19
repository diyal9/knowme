# RQA133：条件路线依赖缺失的审计诊断

日期：2026-09-09

## 发现

生产能力审计已经能把路线的 `skillId` 纳入 `requiredSkillsReady`，但汇总中的 `unavailableSkills` 只代表静态专家必需依赖。这样在审计结果里，办公协作的飞书路线 Skill 未安装时，路线本身会是 `requiredSkillsReady=false`，同时总体 `unavailableSkills=[]`，运维仍需手工对照路线才能知道缺了什么。

## 修正

`buildProductionSummary` 新增 `conditionalUnavailableSkills`：

- 按路线实际声明的 `requiredSkills` 检查安装、启用和 grounding 状态。
- 按 Skill 去重，并列出受影响的 `expertId:routeId`。
- 不把条件 Skill 混入静态 `packageReady`，避免把“当前没有选择该路线”误报为整个专家包损坏。
- 选中条件路线时，仍由 `requiredSkillsReady` 和真实执行回执共同决定 `executionReady` / `productionReady`。

## 验证

```text
node --test --require ./scripts/register-ts.js tests/audit-production-capabilities.test.js
15 tests / 15 pass / 0 fail
```

在当前 `%APPDATA%/KnowMe` 审计中，新增字段会明确指出以下条件 Skill 尚未安装：

- `feishu-today-priority` → `office-partner:today-priority`
- `feishu-meeting-summary` → `office-partner:meeting-summary`
- `feishu-doc-kb` → `office-partner:doc-kb`
- `feishu-related-chats` → `office-partner:related-chats`

当前审计仍为 `packageReady=true`、`executionReady=false`、`productionReady=false`，并识别 7 条没有真实执行回执的条件路线。该修正只增强诊断透明度，不把静态声明或本地夹具结果冒充真实路线执行回执。
