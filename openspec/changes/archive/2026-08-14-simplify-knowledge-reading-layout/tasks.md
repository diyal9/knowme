## 1. 布局收敛

- [x] 1.1 `renderKnowledgeStatusWorkspace` 去掉右侧上下文栏，改为「树 + 阅读」两栏
- [x] 1.2 阅读区文档头承接条目动作（交给 AI 整理 / 查看提案 / 检查问题）
- [x] 1.3 顶栏不再整行输出绝对路径，改为说明文案 + title 提示

## 2. 样式

- [x] 2.1 `.llmwiki-workbench` 改两列栅格，移除上下文栏样式
- [x] 2.2 新增文档头动作行样式，与既有按钮体系一致
- [x] 2.3 900 / 720 / 520px 断点更新为两栏堆叠且无横向溢出

## 3. 验证

- [x] 3.1 更新 `knowledge-web-naming` / `knowledge-page-refactor` / `knowledge-governance-onboarding` 契约测试
- [x] 3.2 `npm test` 与 `npm run lint` 通过
- [x] 3.3 Electron 冒烟：两栏结构、raw 保存、只读阅读、窄窗口无溢出，控制台 0 错误
- [x] 3.4 记录 `evidence/dev-self-test.md` 与桌面/窄窗口截图
