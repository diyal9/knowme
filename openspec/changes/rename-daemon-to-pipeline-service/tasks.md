## 1. 文案替换

- [x] 1.1 替换工作台 HTML/JS 用户可见 `Daemon` → `管线服务`
- [x] 1.2 替换设置页、handoff、console/launch/mode/surface/supply 等用户串
- [x] 1.3 替换 builder/backend 展示标签（`agent-*-state`、`main.js` display map）
- [x] 1.4 更新依赖可见文案的测试断言

## 2. 验证

- [x] 2.1 跑相关单元测试（templates / surface / handoff / console）— 97/97 pass
- [x] 2.2 确认 `src/` 用户可见串不再裸用 `Daemon` 作为产品名
