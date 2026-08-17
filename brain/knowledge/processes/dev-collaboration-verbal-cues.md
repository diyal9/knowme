---
type: Playbook
title: Dev Collaboration Verbal Cues
description: 用户高频口头确认与指令的团队口径（可以/继续/同意、重启服务、评估并优化）。
tags: [process, collaboration, sticky-memory, promotion]
timestamp: 2026-08-17T11:42:00Z
resource: sticky-agent-memory:patterns
---

# 开发协作口头指令口径

来源：本地会话记忆 ≥3 次重复 pattern；2026-08-12 首批升库，2026-08-17 增补「按照建议优化」与附带计划口径。

| Pattern | 原文 | 次数（升库时） | 含义 |
|---------|------|----------------|------|
| `pat_fd901191` | 可以 | ≥9 | 批准当前方案/改动，**直接执行**，勿再二次确认同一问题 |
| `pat_fa0f859d` | 继续 | ≥3 | 按既定计划推进下一步，不重开讨论 |
| `pat_9a4df22d` | 同意 | ≥3 | 与「可以」同级批准；可落地实现或归档 |
| `pat_8c8aff4b` | 执行 | ≥27 | 立即落地/跑通（实现、重启、跑测），勿停在方案讨论；记忆层曾出现乱码摘要「鎵ц」，语义即「执行」 |
| `pat_472fdce2` | 重启服务 | ≥5 | 重启 KnowMe Electron（杀进程 + `npm start`），见 `team-learned-dev-electron-runloop` |
| `pat_8530a8e8` | 重启 | ≥91 | 再跑一次 `npm start` 即重启；不为看 UI 编 dist。见 [Electron Dev Restart And HMR](electron-dev-restart.md) |
| `pat_34476184` | 评估并且优化方案 | ≥3 | 先评估现状/方案利弊，再给出可执行优化并落地，不只停留在分析 |
| `pat_6f6f2eb0` | 按照建议优化 | ≥6 | 与上条同族；记忆层曾乱码「鎸夌収寤鸿浼樺寲」，语义即按已给建议落地优化 |
| `pat_bceaacf5` | Implement the plan as specified… | ≥11 | 附带 plan 落地：不改 plan 文件、不重建 todo、做到全部完成。见 [Attached Plan Execution](attached-plan-execution.md) |

## Agent 行为

1. **可以 / 同意**：视为明确授权；立即 Act，不要重复「是否继续」。
2. **继续**：从当前 OpenSpec / 任务断点接着做，不重置上下文。
3. **执行**：与「可以」同级行动指令；优先实现/重启/自测，少复述计划。
4. **重启服务 / 重启**：走 Electron 跑通闭环 Skill 与 [Electron Dev Restart And HMR](electron-dev-restart.md)，不口头描述代替重启。
5. **评估并且优化方案 / 按照建议优化**：Reason（评估）→ Act（优化实现）→ Observe；评估结论要落到代码或规格，避免空谈。
6. **附带 plan 系统提示**：按 [Attached Plan Execution](attached-plan-execution.md) 执行，勿编辑 plan、勿重建 todo。

## 相关

- Skill：`team-learned-dev-electron-runloop`（打包/执行/重启）
- Playbook：[Electron Dev Restart And HMR](electron-dev-restart.md)
- Playbook：[MCP UI Deep Verify And Code Explore](mcp-ui-and-code-explore-playbook.md)
- Playbook：[Attached Plan Execution](attached-plan-execution.md)
- 登记：[Team Skills](team-skills.md)
- 记忆协议：[Adopt sticky-agent-memory](../decisions/adopt-sticky-agent-memory.md)
- Wiki：[开发协作口头指令](../../wiki/concepts/dev-collaboration-verbal-cues.md)
