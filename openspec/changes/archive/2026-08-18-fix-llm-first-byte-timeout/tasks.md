## 1. 聊天 HTTP 超时与兼容

- [x] 1.1 首包超时 15s + 文案带 host
- [x] 1.2 DashScope Qwen 默认关闭 thinking
- [x] 1.3 请求 `family: 4` / `ipv4first`
- [x] 1.4 workbench-dispatch 共用同一套超时与兼容字段

## 2. 测试

- [x] 2.1 `tests/main-llm-bridge.test.js` 覆盖文案与 `enable_thinking`
