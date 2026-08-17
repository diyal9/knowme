---
type: Playbook
title: Attached Plan Execution
description: Cursor 附带计划落地时的团队口径——不改 plan 文件、复用已有 todo、做到全部完成。
tags: [process, collaboration, sticky-memory, promotion, plan]
timestamp: 2026-08-17T11:42:00Z
resource: sticky-agent-memory:pat_bceaacf5
---

# 附带计划落地口径

来源：本地会话记忆 pattern `pat_bceaacf5`（升库时 ≥11 / registry ≥29 次），用户确认写入 OKF（2026-08-17）。

典型触发文案（英文系统提示，勿当产品文案）：

> Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.  
> To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

## Agent 行为

1. **MUST**：按已附 plan / OpenSpec tasks 实现；**MUST NOT** 编辑 plan 文件本身。
2. **MUST NOT** 重新创建已有 todo；从第一条起标 `in_progress`，做完再标 `completed`。
3. **MUST**：做到 todo 全部完成再停；中途缺证据就补测/补日志，不半截交差。
4. 与口头「可以 / 继续 / 执行」同级：**直接 Act**，少复述计划。

## 相关

- 口头指令：[Dev Collaboration Verbal Cues](dev-collaboration-verbal-cues.md)
- 登记：[Team Skills](team-skills.md)
- Wiki：[附带计划落地](../../wiki/concepts/attached-plan-execution.md)
