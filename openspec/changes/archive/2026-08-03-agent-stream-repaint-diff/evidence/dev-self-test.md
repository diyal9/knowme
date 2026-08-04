# 开发自测：agent-stream-repaint-diff

日期：2026-08-03

## 硬门禁

```
npm run lint   → lint ok / script-scope ok
npm test       → tests 730 / pass 730 / fail 0
```

## 浏览器行为验证（Chromium via Playwright）

把 `src/workspace-agent.js` 中的 `quickHash` / `withSig` / `elementSignature` /
`reconcileKeyedChildren` / `syncTextNode` / `isStreamTail` / `reconcileStreamChildren` /
`patchExecutionTimeline` 用大括号配平**机械抽取**到临时 harness 页面，在真实 DOM 下断言节点身份。
20 项全部 PASS：

| 分组 | 断言 |
|------|------|
| 签名 | `withSig` 在根标签注入 `data-sig`；同内容同签名；内容变则签名变 |
| 时间线行 | 未变化行保持同一节点；用户展开的工具 `<details>` 在刷新后仍展开；变化行被替换且不波及兄弟；新增行只追加 |
| 时间线整体 | 每秒计时只改 `.agent-execution-meta` 文本；呼吸球 / trace 行 / 计划项节点身份不变；用户折叠后不被强制重开 |
| 流式正文 | 尾行走 `textContent` 原地更新；已渲染段落节点身份不变；尾行定稿成段落时前面段落不重建；内容收缩时移除多余节点 |

关键含义：呼吸球与 pulse 动画不再每秒从头重播，已渲染正文不再每帧整块重排 —— 这两点正是闪屏来源。

## 应用启动自测

`npm start` 重启后控制台仅剩 Electron 开发期 CSP 警告（打包后不出现），无报错。

启动时暴露出一个既有缺陷并已修复：`src/lib/agent-presence.js` 在顶层声明 `const api`，
与 `workspace.html` 中的 `const api = window.api || {}` 共享经典脚本顶层词法作用域，
抛 `Identifier 'api' has already been declared`，导致整个 presence 脚本加载失败。
改名为 `agentPresenceApi` 后消失。

## 未覆盖

- 真机长回答的主观流畅度需制作人体验验收
- 流结束时 suggestion 代码块 → 交互卡片的一次性结构切换仍保留（本次 non-goal）
