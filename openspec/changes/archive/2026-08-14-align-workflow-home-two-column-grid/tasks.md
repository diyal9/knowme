## 1. 布局

- [x] 1.1 将 `.wb-shelf-grid` 的 `grid-template-columns` 改为 `repeat(2, minmax(0, 1fr))`，与 `.wb-workflow-manage-list` 对齐
- [x] 1.2 确认 `@media (max-width: 900px)` 下 `.wb-shelf-grid` 仍为单列

## 2. 展开高度

- [x] 2.1 提高 `.wb-shelf-grid.is-expanded` 限高，使常规桌面下至少完整两行
- [x] 2.2 静态测试锁定展开限高下限

## 3. 去掉误导性修改时间

- [x] 3.1 首页卡页脚移除「模板修改于…」，仅保留「N 步」
- [x] 3.2 更新静态测试与 CSS（去掉 `.wb-shelf-updated`）

## 4. 自测

- [x] 4.1 `npm test` 与 `npm run lint` 通过
- [x] 4.2 更新 `evidence/dev-self-test.md`
