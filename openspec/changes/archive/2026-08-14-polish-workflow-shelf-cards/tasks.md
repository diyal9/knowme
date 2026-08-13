## 1. 卡片结构

- [x] 1.1 重写 `shelfCardHtml`：领域图标井、标题层级、chip meta、压缩阻塞行
- [x] 1.2 避免说明与产出完全重复时双段同文

## 2. 样式

- [x] 2.1 更新 `workbench-shelf.css`：标题层级、图标井、领域色、chip、阻塞左边色与 hover
- [x] 2.2 对齐专家卡 mark 尺度，保持页脚图标按钮不变

## 3. 验证

- [x] 3.1 更新 `tests/workbench-templates.test.js` 结构断言
- [x] 3.2 跑 `npm test` / `npm run lint`，写 `evidence/dev-self-test.md` 与 `qa-plan.md`

## 4. 领域筛选性能

- [x] 4.1 `selectConsoleDomain` 仅本地过滤：不调 `selectMode`、不重绘 Studio；同域点击短路
- [x] 4.2 测试断言领域筛选与模式切换解耦；更新自测证据
