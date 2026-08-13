## 1. 抽出 surface 路由

- [ ] 1.1 新增 `src/workbench/surface-router.js`（`setSurface` 分发 + surface 常量）
- [ ] 1.2 `workbench.js` 改为调用该模块；行为与拆前一致
- [ ] 1.3 如有相关契约测试则更新 import/路径断言

## 2. 抽出首批事件绑定

- [ ] 2.1 新增 `src/workbench/bind-chrome-events.js`（顶栏/货架 chrome 一次性绑定，deps 注入）
- [ ] 2.2 `workbench.js` 接入；确认返回/Tab/surface 切换仍可用

## 3. 自测与约定

- [ ] 3.1 `npm test` / `npm run lint`
- [ ] 3.2 写 `evidence/dev-self-test.md`；在 design/README 片段记录后续拆分顺序
- [ ] 3.3 重启 Electron 冒烟：工作流货架 ↔ task-room ↔ studio 切换
