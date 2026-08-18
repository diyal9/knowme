## 1. 切断货架注入

- [x] 1.1 修改 `buildWorkflowShelf`：不再传入 `resolveVerticalPipelines`，`verticals` 固定为空
- [x] 1.2 确认 `workflow-supply` 在 `verticals: []` 时仅输出 repo/daemon/personal

## 2. 测试与回归

- [x] 2.1 新增/调整单测：默认供给不含三条种子 id
- [x] 2.2 更新依赖「货架必有垂直种子」的断言（若有）
- [x] 2.3 运行 `npm test` 与 `npm run lint`

## 3. 验收工件

- [x] 3.1 填写 `qa-plan.md` Smoke Scope
- [x] 3.2 填写 `acceptance.md` 制作人验收清单
- [x] 3.3 本地刷新工作台确认货架无演示卡
