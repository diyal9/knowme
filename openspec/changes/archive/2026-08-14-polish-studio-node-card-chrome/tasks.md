## 1. 类型色全宽头栏

- [x] 1.1 在 `workbench-console.css` 为各 `kind-*` 头栏设置全宽主题 tint 底与可读标题色，并去掉顶边 3px 色条依赖
- [x] 1.2 调整头栏内图标、类型标签、操作按钮在色带上的对比与圆角衔接；确认选中蓝框与类型色共存

## 2. 正文重点层次

- [x] 2.1 弱化分区标题、强化取值（含 mode-text）；警示/空态（`is-warn`）更醒目
- [x] 2.2 必要时微调 `studioCanvasSectionsHtml` class，保证取值与标题语义清晰（尽量纯 CSS）

## 3. 自测与证据

- [x] 3.1 跑 `npm test` 与 `npm run lint`；记录 `evidence/dev-self-test.md`
- [x] 3.2 本地打开工作室确认 tool/knowledge/llm/agent 头栏与空态层次（截图可选）
