---
type: Playbook
title: MCP UI Deep Verify And Code Explore
description: Playwright 深验（run_code/press_key/network）与 GitNexus list_repos 的团队 SOP。
tags: [process, mcp, playwright, gitnexus, sticky-memory, promotion]
timestamp: 2026-08-12T18:45:00Z
resource: sticky-agent-memory:patterns
---

# MCP 深验 UI 与代码探索 SOP

来源：本地会话记忆 ≥3 次重复 pattern，用户确认写入 OKF（2026-08-12）。

| Pattern | 工具 / 摘要 | 次数（升库时） | 含义 |
|---------|-------------|---------------|------|
| `pat_d3afb407` | MCP · `browser_run_code_unsafe` | ≥9 | 在页面上下文执行脚本核对 DOM/状态 |
| `pat_6b67301f` | MCP · `browser_press_key` | ≥3 | 键盘路径冒烟（Esc/Enter/快捷键） |
| `pat_4d3fefc0` | MCP · `browser_network_requests` | ≥3 | 核对请求是否异常、是否打到错误后端 |
| `pat_e8d31dc4` | MCP · `list_repos` | ≥18 | GitNexus 多仓时先列库再 query/impact |

## Agent 行为

### Playwright（`user-playwright`）

1. 基础路径仍走 Skill `team-learned-dev-playwright-ui-verify`（`navigate` + `screenshot`）。
2. **深验**在截图不够时启用：
   - `browser_run_code_unsafe`：读 class/aria、surface 标志、隐藏态；勿用于破坏性写盘。
   - `browser_press_key`：验证焦点与快捷键，不替代点击主路径。
   - `browser_network_requests`：改动联网/IPC 代理后核对无异常失败。
3. Electron 真机壳仍用 `npm start`；MCP 浏览器不能替代原生窗口。

### GitNexus（`user-gitnexus`）

1. 多仓或不确定 repo 时 **先** `list_repos`，再带 `repo` 调 `query` / `impact` / `context`。
2. KnowMe 本仓若未索引，勿强行用错误仓库结论；回退到本地 Grep/Read。

## 相关

- Skill：`team-learned-dev-playwright-ui-verify`、`team-learned-dev-electron-runloop`
- 口头指令：[Dev Collaboration Verbal Cues](dev-collaboration-verbal-cues.md)（「执行」）
- 登记：[Team Skills](team-skills.md)
- Wiki：[MCP 深验与代码探索](../../wiki/concepts/mcp-ui-and-code-explore.md)
