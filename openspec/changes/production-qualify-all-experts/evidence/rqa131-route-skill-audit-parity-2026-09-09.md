# RQA131：条件路由的 Skill 审计口径与运行时一致

日期：2026-09-09  
范围：生产能力审计 `collectConditionalRouteRequirements` 与当前保留专家的声明式 execution route。

## 发现

办公协作专家的今日安排、会议总结、文档/知识库、相关聊天路线通过 `skillId` 声明必需 Skill，但审计器此前只读取 `requiredSkills`。因此路线报告会显示为空 Skill 依赖，无法准确判断条件路线是否具备对应方法。

## 修正

- 审计器现在将 route 的 `skillId` 与 `requiredSkills` 合并、去重并纳入 `requiredSkillsReady`。
- 成果物路线继续读取 `deliverable.requiredSkills`，不改变已有成果物契约。
- 没有放宽真实工具回执、连接器授权或 `productionReady` 门禁。

## 验证

- `tests/audit-production-capabilities.test.js`：`12/12` 通过。
- 真实 `%APPDATA%/KnowMe` 审计复跑：7 条条件路线仍未取得真实执行回执，但办公协作四条路线现在分别明确显示：
  - `today-priority` → `feishu-today-priority`
  - `meeting-summary` → `feishu-meeting-summary`
  - `doc-kb` → `feishu-doc-kb`
  - `related-chats` → `feishu-related-chats`
- 生图和研究路线的 Skill 依赖也在审计结果中完整显示。

## 边界

本轮修复的是生产审计与声明式路线的契约一致性，不代表条件路线已经真实执行成功；当前仍保持 `executionReady=false`、`productionReady=false`，真实 Provider/连接器执行和独立专业评审仍需完成。
