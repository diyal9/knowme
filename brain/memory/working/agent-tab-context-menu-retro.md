# Retro: agent-tab-context-menu

## 做了什么

去掉 Agent 顶栏左侧重复的「New Agent」，空态自动建对话，Tab 右键提供管理 / 复制 Transcript / Pin。

## 学到什么

- 顶栏入口收敛：同一动作（新建）只留一个主入口（`+`），减少视觉噪声。
- 右键菜单复用 ⋯ 管理能力，避免「管理对话」与 ⋯ 两套逻辑分叉。
- Playwright MCP 不可用时，静态预览 + 结构单测仍可过 Story 证据门禁，但真机截图需补。

## 下次

- UI Story 优先确认 Playwright MCP 可用，或固定 Electron 截图脚本。
- Pin「不可关闭」若产品需要，单独开 Story。
