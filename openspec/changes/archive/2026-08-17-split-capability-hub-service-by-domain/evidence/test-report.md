# Test Report: split-capability-hub-service-by-domain

- 日期：2026-08-17
- 执行人：developer agent

## 定向测试

```bash
node -r ./scripts/register-ts.js --test tests/capability-hub.test.js
node -r ./scripts/register-ts.js --test tests/capability-integration.test.js
node -r ./scripts/register-ts.js --test tests/session-knowledge-scope.test.js
node -r ./scripts/register-ts.js --test tests/skill-task-catalog.test.js
```

结果：**41 pass / 0 fail**

## 全量门禁

```bash
npm test   # 1576 pass / 0 fail / 51 skipped
npm run lint  # architecture ok, lint ok
```

## 变更说明

- `tests/skill-task-catalog.test.js`：IPC 注册断言改为 `capability-hub/ipc.ts`（重构后通道实现位置变更，通道名不变）
