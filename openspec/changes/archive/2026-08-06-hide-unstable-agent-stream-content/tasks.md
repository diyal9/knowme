## 1. Stable stream visibility

- [x] 1.1 修改 streaming Markdown 渲染，使未完成 tail 只保留在内存且不进入用户可见 DOM
- [x] 1.2 增加固定低干扰 pending 状态，并保持稳定块与正文容器的增量更新
- [x] 1.3 确保完成、取消和错误路径移除 pending 状态并保留完整格式化正文

## 2. Regression coverage

- [x] 2.1 增加半行、标题、列表、表格、代码围栏、链接与协议 JSON 的零原文闪现测试
- [x] 2.2 更新既有 streaming repaint 契约，禁止 `.md-stream-tail` 原文路径
- [x] 2.3 验证稳定块、气泡、正文容器和用户滚动状态不回归

## 3. Quality gates

- [x] 3.1 运行定向测试、完整 `npm test`、`npm run lint` 与 OpenSpec strict validate
- [x] 3.2 重启 KnowMe 并完成流式输出冒烟，记录 `evidence/dev-self-test.md`
