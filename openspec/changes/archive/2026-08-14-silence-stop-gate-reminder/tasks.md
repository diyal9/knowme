## 1. Hook 配置修复

- [x] 1.1 从项目级 `stop` Hook 注册中移除 `stop-gate-reminder.js`，保留记忆收尾 Hook
- [x] 1.2 增加 Hook 配置契约测试，禁止普通停止事件重新注入可见门禁续聊

## 2. 验证

- [x] 2.1 运行 Hook 定向测试与 OpenSpec 严格校验
- [x] 2.2 运行完整 `npm test` 和 `npm run lint`，记录开发自测结果
