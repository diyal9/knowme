---
name: /start
id: start
category: Team
description: 智能体仓库 onboarding — 读 AGENTS.md，跑 preflight，选择角色
---

# 启动 StickyNotes 智能体仓库

1. 读取 `AGENTS.md` 与 `team/charter.md`
2. 运行 `npm run harness:preflight`
3. 询问用户目标，路由到：
   - 规划新版本 → `/role-producer` 或 `/opsx:propose`
   - 实现功能 → `/role-developer` 或 `/opsx:apply`
   - 测试验收 → `/role-tester`
   - 全自动循环 → `/team-run`

输出：当前 change 列表、harness 状态、建议下一步。
