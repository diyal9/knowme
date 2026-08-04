# Retro: log-viewer-run-grouping

日期：2026-07-30 · 角色：制作人 / 开发 / 测试

## 做了什么

日志中心把同一 `runId` 的多轮日志合并成可展开的对话卡片，卡片头汇总轮次 / 条数 / 模型 / 耗时 / 起止时间，
展开后按「第 N 轮」分节；提供「按对话合并」开关（localStorage 持久化）。

## 有效做法

- **纯函数 + 双端导出**：`src/lib/log-grouping.js` 用 `module.exports` + `window.LogGrouping` 双导出，
  分组逻辑能被 `node:test` 直接覆盖，渲染层只负责 DOM。UI 页的逻辑要单测，就把它挤出 DOM。
- **桩数据本地 http 复刻页面做验收**：Playwright MCP 打不开 Electron 壳，但把 `log-viewer.html` 复制到临时目录、
  注入一个 stub `window.api` 后用 `python -m http.server` 起页面，就能真实走查交互并留截图证据。
  注意 `--directory` 用绝对路径（相对路径在本机 junction 下解析失败，全部 404）。

## 验收/QA 抓到的三类问题（都是"自测通过但体验不合格"）

1. 新增折叠组件只绑 `click`，键盘用户够不到 → 抽 `bindDisclosure` 统一 `role/tabindex/aria-expanded` + Enter/Space + 焦点环。
2. Toggle 按钮文案随状态切换（「按对话合并」↔「平铺显示」），读不出是状态还是动作 → 文案固定，用高亮 + `aria-pressed` 表状态。
3. 汇总数字取自"原始语义"而非"当前卡片内容"：筛选后仍显示 2 轮 → 改为组内不同轮号的数量。

## 可复用的教训

- **汇总类 UI 的数字必须描述"当前视图里有什么"**，否则筛选一介入就变成误导。
- **新增可折叠组件时，键盘可达 + `aria-expanded` 应作为默认动作**，不要等 QA 提。
- 三角色循环里，"打回开发"这一步真的会抓到东西：本轮 3 个问题全部来自验收/反模式走查，自动化测试一个都没覆盖到。

## 证据

`openspec/changes/archive/2026-07-30-log-viewer-run-grouping/`（acceptance / test-report / code-review / screenshots）
