---
name: /team-run
id: team-run
category: Team
description: 三角色 ReACT 自循环 — 制作人→开发→验收→测试
---

启动团队协作 ReACT 循环。读取并遵循 `team-run` skill。

按状态机自动推进：
**规划(制作人) → 开发+自测 → 制作人验收 → 测试 QA → /story-done**

每轮输出：当前阶段、门禁状态、证据路径、下一步。
发现 Bug 不跳关，责任角色修复后重过门禁。

可选输入：change 名称或版本目标。
