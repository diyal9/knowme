---
name: team-learned-dev-playwright-ui-verify
description: >-
  Use when verifying KnowMe UI with Playwright MCP (browser_navigate,
  browser_take_screenshot, browser_console_messages, browser_resize,
  browser_tabs), collecting visual evidence after layout or toolbar changes.
---

# Playwright MCP 验 UI

本仓库反复用 Playwright MCP 做界面核对。固化打开、视口、多标签、控制台与截图顺序，避免 `file://` 踩坑与无证据空转。

## When to Use

- 用户要「看效果 / 截图 / 对比前后 UI」
- 改了工作台 / 助理 / 工具栏 / 侧栏等视觉层
- 制作人验收或 QA 需要 `evidence/screenshots/`

## When NOT to Use

- 纯主进程 / IPC / 单测能覆盖的逻辑（优先 `npm test`）
- Electron 原生窗口控件（托盘、系统对话框）—— Playwright 浏览器 MCP **打不开** Electron 壳，只能验静态 HTML 预览或本地 http 页；真机壳用 `npm start` + Playwright `_electron` 冒烟
- 用户明确只要代码、不要截图

## Workflow

### 1. 选承载方式

| 场景 | 做法 |
|------|------|
| 静态预览（图标/CSS 片段） | 写临时 HTML → `python -m http.server <闲置端口> --directory <dir>` → `http://127.0.0.1:<port>/…` |
| 已有本地页 | 直接 `browser_navigate` 到 `http://127.0.0.1:…` |
| 真机 Electron | `npm start`（见 `team-learned-dev-electron-runloop`）；MCP 浏览器**不能**替代真机壳 |

**禁止**依赖 `file://`：Playwright MCP 会拦截。

### 2. 标准核对链（高频 MCP）

按需取用，不必每次全跑：

| 步骤 | 工具 | 用途 |
|------|------|------|
| 开页 | `browser_navigate` | 进目标 URL |
| 视口 | `browser_resize` | 固定桌面/窄屏再截图，避免布局漂移误判 |
| 多标签 | `browser_tabs` | 列/切标签，确认没开错页或残留会话 |
| 结构 | `browser_snapshot` | 再 click/fill |
| 控制台 | `browser_console_messages` | 抓 JS error；favicon 404 可忽略 |
| 证据 | `browser_take_screenshot` | 建议 `scale: "device"`，拷到 `evidence/screenshots/` |

深验（DOM 脚本 / 快捷键 / 网络）见 OKF `mcp-ui-and-code-explore-playbook.md`。

### 3. 收尾

- 关掉临时 http.server（若本次拉起）  
- 业务 4xx / JS error 记入报告；仅 favicon 可忽略

## 常见坑

- 端口被占用：换高位端口（如 `18901`），先 `curl` 确认 200  
- 截图路径落在 Playwright cwd：主动指定 `filename` 或复制到 `evidence/`  
- 把「浏览器静态预览通过」写成「Electron 真机通过」——二者分开写

## 与角色门禁

- 开发自测：截图可选，但 UI Story 强烈建议有  
- QA：反模式走查可配合截图证据  
- 不要用截图代替 `npm test` / `lint`
