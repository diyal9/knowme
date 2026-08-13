## 1. Structure & Icons

- [x] 1.1 调整 `workspace.html` 工具栏：左侧 tools 容器 + 标题 + 右侧 actions
- [x] 1.2 `ui-icons.js` 补齐 save / align 相关 Lucide 图标（若缺失）
- [x] 1.3 CSS：图标工具按钮样式，与现有 shelf/nav 图标按钮一致

## 2. Behavior

- [x] 2.1 `renderStudio`：右侧三按钮图标化；左侧布局工具（专业画布）
- [x] 2.2 实现一键整理：调用 canvas autoLayout 写回节点并 fit
- [x] 2.3 实现左对齐 / 顶对齐 / 水平居中
- [x] 2.4 绑定 `data-studio-tool` / `data-studio-action` 点击；轻量模式隐藏布局工具

## 3. Tests & Evidence

- [x] 3.1 为布局对齐纯函数补充单元测试
- [x] 3.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md`
