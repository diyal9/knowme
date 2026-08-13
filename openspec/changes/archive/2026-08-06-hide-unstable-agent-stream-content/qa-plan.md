# QA Plan：隐藏不稳定流式原文

## Smoke Scope

- [x] 半行 Markdown 不显示源码，只显示「正在整理…」状态。
- [x] 未闭合标题、列表、表格、代码围栏和链接不以原始标记闪现。
- [x] suggestion/thinking/JSON 片段在流式与完成路径均零泄漏。
- [x] 完整稳定块直接以最终 Markdown 样式出现。
- [x] 完成时剩余内容格式化显示，正文容器不被替换。
- [x] 取消与错误会移除 pending 状态且保留可读终态。
- [x] 用户主动上滑后，稳定块和 pending 状态更新不抢滚动位置。
- [x] V2 canonical answer、旧会话与结构化选择无回归。

## Automation

- `node --test tests/agent-stream-repaint.test.js tests/agent-stream-visibility.test.js`
- `npm test`
- `npm run lint`
- `npx openspec validate hide-unstable-agent-stream-content --strict`

## Quantitative thresholds

- 未完成模型原文用户可见时长：0 ms。
- 同一内容从原始文本替换为格式化节点：0 次。
- 完成前后正文容器 `isSameNode`：100%。
- 非 stick 状态滚动漂移：小于 8 px。

## Anti-pattern checks

- 用 `escHtml(tail)` 把未完成模型文本塞入可见 DOM。
- 用 CSS 隐藏但仍把协议原文写入 DOM。
- 为隐藏 tail 而等待整段回答，导致稳定段落也不能渐进显示。
- 完成时全量重建聊天列表或当前助手气泡。
