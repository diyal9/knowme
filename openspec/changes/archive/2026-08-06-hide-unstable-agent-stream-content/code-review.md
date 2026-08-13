# Code Review

- 日期：2026-08-06
- Change：`hide-unstable-agent-stream-content`
- 结论：PASS，可进入制作人验收

## 审查范围

- `src/lib/agent-stream-visibility.js`
- `src/workspace-agent.js`
- `src/workspace.html`
- 流式可见性、重绘、fixture 与 Electron smoke 测试
- proposal / delta spec / design / tasks / qa-plan

## BLOCKING

无。

## 已核验

- 未完成 tail 不再通过 `escHtml(tail)` 或 `.md-stream-tail` 进入 DOM。
- pending 节点只包含固定产品文案，不包含模型文本。
- legacy 流式绘制先经过 `stripDisplayProtocolText`，不再绕过协议清洗。
- sentinel 保留流式换行边界，完整标题、列表等可直接按 Markdown 显示。
- 表格与未闭合代码围栏在稳定前保持缓冲。
- V2 继续仅展示 canonical answer。
- 完成、取消和失败路径走非 streaming 正文渲染，pending 不残留。
- 完成前后正文容器与气泡保持节点身份。
- Markdown 内容继续经过现有转义与链接安全处理。

## ADVISORY

- 非标准无尾 `|` 表格不属于现有 Markdown 表格语法，可能按普通段落处理。
- `AgentStreamVisibility` 脚本加载失败时采取安全降级：隐藏流式正文，完成后再显示。
- `lastStreamHtml` 仍为既有单槽状态；当前串行单 Run 约束下不阻塞本 change。
- 后续可把更多静态 reconcile 契约升级为运行时 DOM 测试。

## 补测落实

- Electron smoke 增加半行标题、thinking JSON、suggestion、未闭合代码围栏、未完成链接、稳定列表、表格和完成节点身份。
- 全量测试、lint、strict validate 与 Electron 真壳均通过。
