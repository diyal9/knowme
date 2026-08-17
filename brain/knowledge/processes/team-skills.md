---
type: Reference
title: Team Skills Registry
description: Registry of team-learned and core skills for KnowMe agent repo.
tags: [process, skills, registry]
timestamp: 2026-07-01T00:00:00Z
---

# Core Skills

| Skill | 用途 |
|-------|------|
| `team-producer` | 制作人规划与验收 |
| `team-developer` | 开发实现与自测 |
| `team-tester` | QA 与反模式 |
| `team-run` | ReACT 编排 |
| `llm-wiki-maintenance` | Wiki/OKF ingest/query/lint |
| `sticky-agent-memory` | Hook 本地会话记忆 |
| `team-evolution` | Skill 升格 |

# Team-Learned Skills

| Skill | 触发 | 批准日期 |
|-------|------|----------|
| `team-learned-dev-electron-runloop` | 打包 / 执行 / 重启 / `npm start` / electron-builder | 2026-07-16 |
| `team-learned-dev-playwright-ui-verify` | Playwright MCP：navigate / resize / tabs / console / screenshot | 2026-07-16（2026-08-17 扩标准链） |

# Promotion

流程见 `team/evolution/skill-promotion.md`，命令 `/evolve`。

相关口头协作口径：[Dev Collaboration Verbal Cues](dev-collaboration-verbal-cues.md)。  
附带计划落地：[Attached Plan Execution](attached-plan-execution.md)。  
开发重启口径：[Electron Dev Restart And HMR](electron-dev-restart.md)。  
MCP 深验 / GitNexus 入口：[MCP UI Deep Verify And Code Explore](mcp-ui-and-code-explore-playbook.md)。
