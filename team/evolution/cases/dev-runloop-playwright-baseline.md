# Baseline: electron-runloop + playwright-ui-verify

## 无 Skill 时的失败表现

1. **打包/执行/重启**：Agent 口头答应重启却不跑 `npm start`，或只刷新概念不杀进程；打包命令与 `build:win`/`build:dir` 混淆。
2. **Playwright 验 UI**：对预览页使用 `file://` 被 MCP 拦截；截图不落 `evidence/`；把浏览器预览误报为 Electron 真机通过。

## 复发依据（sticky-agent-memory）

| pattern_id | 摘要 | count |
|------------|------|-------|
| pat_7601722d | 打包 | ≥3 |
| pat_8c8aff4b | 执行 | ≥17 |
| pat_8530a8e8 | 重启 | ≥16 |
| pat_fb156d79 | MCP browser_navigate | ≥7 |
| pat_66d65622 | MCP browser_take_screenshot | ≥4 |

## GREEN

已建：

- `.cursor/skills/team-learned-dev-electron-runloop/`
- `.cursor/skills/team-learned-dev-playwright-ui-verify/`

批准：用户 2026-07-16「建 skill 吧」
