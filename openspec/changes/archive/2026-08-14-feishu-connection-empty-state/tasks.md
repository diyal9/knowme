## 1. Pack 空状态内容

- [x] 1.1 更新 `pack.json`：清空 kicker，改写 hero/sub 为飞书连接导向
- [x] 1.2 更新 `scenes.json`：角色场景 `showInEmptyState: false`；新增四张飞书连接/intake 空状态场景与 prompts

## 2. 运行时与渲染

- [x] 2.1 `listEmptyStateGroups` 对空字符串 kicker 使用 nullish 透传，不回退 pack 名
- [x] 2.2 `renderPackEmptyStateHtml` 仅在 kicker 非空时渲染 kicker 行

## 3. 验证

- [x] 3.1 更新 `tests/game-studio-scenes.test.js` 覆盖空状态列表与路由回归
- [x] 3.2 运行聚焦测试、`npm test`、`npm run lint`、OpenSpec strict validate，写开发自测证据
