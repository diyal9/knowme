## 1. 宿主详情叠层

- [x] 1.1 扩展 `buildCapabilityHubSrc` / `resumeCapabilityHubFrame`：支持 `presentation`
- [x] 1.2 新增 `openCapabilityHub` 的 detail 分支：`drawerKind=capability-hub-detail`，透明覆盖，不抢工作台 rail
- [x] 1.3 `capability-hub-close` / Esc / park / message 源识别覆盖 detail kind；开工成功后关闭叠层

## 2. Hub presentation 与底栏

- [x] 2.1 解析并应用 `presentation=detail`（URL + resume）；`hub-detail-only` 隐藏壳层
- [x] 2.2 detail 下关闭详情即 `closeHub()`；开工成功后关闭
- [x] 2.3 `surface=workbench` 底栏仅开工 CTA；能力面保持现状；bump html 缓存版本

## 3. 工作台入口

- [x] 3.1 快捷专家卡传入 `{ expertId, surface: 'workbench', presentation: 'detail' }`
- [x] 3.2 确认「+ 新建任务」仍 `openTaskComposer()`

## 4. 测试与自测

- [x] 4.1 更新 `tests/capability-hub.test.js`：detail presentation + 工作台仅 start
- [x] 4.2 更新 `tests/expert-task-chat-workbench.test.js`：presentation=detail
- [x] 4.3 跑 `npm test && npm run lint`；写 `evidence/dev-self-test.md`
