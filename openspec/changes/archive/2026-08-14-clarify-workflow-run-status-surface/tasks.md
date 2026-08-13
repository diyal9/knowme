## 1. 顶栏结构

- [x] 1.1 移除运行顶栏 `#wbTaskBackToList`「返回货架」按钮及相关绑定
- [x] 1.2 标题区增加 `#wbRunOutcome` Status Pill，并在 `syncRunTopbar` / runner 渲染中维护

## 2. 状态分层

- [x] 2.1 实现 L1 outcome 映射（label + tone），覆盖 daemon / agent-graph / 本地 runner
- [x] 2.2 `elRunnerMeta` 改为 L2 节点进度摘要，避免与 Pill 重复结论
- [x] 2.3 Daemon 步骤 Tab 增加「当前节点 · 进度」小结条

## 3. 样式与契约

- [x] 3.1 在 `workbench-shelf.css` 增加 Outcome Pill 样式（与现有 tone token 对齐）
- [x] 3.2 更新 `tests/workbench-templates.test.js` 静态契约
- [x] 3.3 修正依赖 `#wbTaskBackToList` 的 evidence smoke 点击路径
- [x] 3.4 编写 `evidence/dev-self-test.md` 并跑 `npm test` / `npm run lint`
