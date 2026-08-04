# Code Review: agent-stream-repaint-diff

日期：2026-08-03 · 范围：`src/workspace-agent.js`、`tests/agent-stream-repaint.test.js`

## 改动摘要

| 位置 | 改动 |
|------|------|
| `withSig` / `quickHash` | 在 HTML 生成阶段给可 diff 的行注入 `data-sig`（djb2，非安全用途） |
| `reconcileKeyedChildren` | 按位置比签名，只替换变化的子元素，多余的删掉 |
| `patchExecutionTimeline` | 原地更新 summary 图标 / 标题 / 计时、计划清单、trace 列表 |
| `refreshAssistantProgress` | 优先 patch，patch 不适用时才回退整棵 `replaceWith` |
| `reconcileStreamChildren` | 流式正文按子节点 diff；尾行与文本节点走原地写值 |
| `upgradeThinkingBubble` | 首 token 时就地把思考气泡变正文气泡 |

## 审查点

- **签名稳定性**：`withSig` 的哈希基于「未注入签名前」的 HTML，同一渲染函数下确定性成立；用户手动展开 `<details>` 不改 `data-sig`，所以展开态能跨刷新保留。
- **回退路径完好**：`patchExecutionTimeline` 只在 current/next 任一缺失时返回 `false`，调用方保留 `replaceWith` 与首次插入分支，不会出现时间线消失。
- **不再强制展开**：patch 路径刻意不写 `open`，尊重用户折叠；首次创建仍按 `keepExpanded` 生成 `open`。流结束的全量 `renderChat` 行为未变。
- **节点搬移安全**：`reconcile*` 先 `Array.from` 快照再操作，`appendChild(next)` 会把节点从临时容器摘走，不影响后续索引。
- **XSS 面未扩大**：所有插入内容仍由既有 `escHtml` / `renderMarkdown` 产出，`withSig` 只加一个数字属性。
- **性能**：`renderExecutionTimeline` 仍是纯字符串拼接（签名在生成时算），`renderChat` 没有新增 DOM 解析；`buildExecutionTimelineNode` 只在 patch 路径解析一次。

## 遗留 / 后续

- 流结束时 ` ```suggestion` 代码块 → 交互卡片的一次性结构切换仍在（本次 non-goal，可另开 change 做流式内预渲染）
- `lastStreamHtml` 仍是单条全局缓存，多条消息同时流式时会退化为每帧全量 diff；当前产品只允许单条并发，暂不处理
