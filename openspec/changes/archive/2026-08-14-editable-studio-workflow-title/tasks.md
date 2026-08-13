## 1. 顶栏结构

- [x] 1.1 `workspace.html`：主标题改为可点击名称控件；副行仍用 `#wbStudioTopMeta`
- [x] 1.2 CSS：可编辑标题与编辑态 input 样式

## 2. 逻辑

- [x] 2.1 渲染：主标题 = 工作流名；meta =「编排工作流 · …」
- [x] 2.2 点击改名：Enter/blur 提交，Esc 取消；同步 draft + Inspector 名称字段

## 3. 验证

- [x] 3.1 更新相关测试断言
- [x] 3.2 `npm test` / `npm run lint` + evidence
