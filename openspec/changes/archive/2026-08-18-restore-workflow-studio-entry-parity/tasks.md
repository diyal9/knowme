## 1. Studio 进出

- [x] 1.1 打开草稿：货架 graph / GET / list；新建 reset；goal 用 graph.goal
- [x] 1.2 返回：manage+workflows 或 shelf；离开三按钮
- [x] 1.3 fork 传 name+package

## 2. 管理 / 货架 UI

- [x] 2.1 管理卡仅图标触发编辑/复制/删除
- [x] 2.2 货架空态按钮

## 3. 测试

- [x] 3.1 manage/studio/shelf 回归（34/34）
- [x] 3.2 lint / typecheck:renderer 通过；相关 vitest 通过。全量 `npm test` 仍有既有失败（agent-runtime / audit / web-search），与本 change 无关。
