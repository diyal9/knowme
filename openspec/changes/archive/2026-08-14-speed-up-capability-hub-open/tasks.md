## 1. Host iframe keep-alive

- [x] 1.1 在工作台增加 capability Hub park 容器与 `parkCapabilityHubFrame` / `mountCapabilityHubFrame` 辅助函数
- [x] 1.2 `closeDrawer` 与其它中心面写入 `drawerBody` 前 park Hub；`openCapabilityHub` 优先复用 park 的 iframe 并 postMessage resume/select
- [x] 1.3 更新 `tests/workspace-capability-rail.test.js` 覆盖 park/reuse/resume 契约

## 2. Progressive Hub catalog load

- [x] 2.1 重构 `loadCatalog`：主目录返回后立即结束 skeleton 并渲染；辅助数据后台补齐且不再整页 skeleton
- [x] 2.2 处理 `capability-hub-resume`（及既有 select-expert）：复用打开时同步 tab/深链并轻量刷新绑定
- [x] 2.3 更新 `tests/capability-hub.test.js` 覆盖渐进加载与 resume 契约

## 3. Verification

- [x] 3.1 运行相关测试与 `npm test` / `npm run lint`，写入 `evidence/dev-self-test.md`
