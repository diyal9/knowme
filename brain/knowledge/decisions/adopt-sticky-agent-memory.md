---
type: Decision
title: Adopt sticky-agent-memory Hook Layer
description: Port episodic local memory from th-bi-agent-memory; personal memory in LOCALAPPDATA, team facts in brain/knowledge OKF.
tags: [decision, memory, hook, evolution]
timestamp: 2026-07-01T00:00:00Z
---

# Context

团队 OKF（`brain/knowledge/`）擅长长期可交换知识，但缺少**会话级自动记忆**（指正、习惯、重复模式）。

# Decision

移植 th-bi-agent-memory 协议为 `sticky-agent-memory`：

| 层 | 位置 | 写入 |
|----|------|------|
| Episodic | `%LOCALAPPDATA%\knowme\memory\<ws>\` | Python Hook 自动 |
| Team OKF | `brain/knowledge/` | 用户确认 + `/kb-ingest` |

Hook：`.cursor/hooks/memory_cursor_hook.py`  
关闭：`STICKY_MEMORY=0`

# Consequences

- 个人记忆不入 git，隐私更好
- ≥3 次重复 → pending → Agent 询问升 OKF/Skill
- 与 [Evolution Loop](/processes/evolution-loop.md) 衔接

# Related

- Skill: `.cursor/skills/sticky-agent-memory/SKILL.md`
- [Adopt LLM Wiki + OKF](/decisions/adopt-llm-wiki-okf.md)
