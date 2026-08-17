# 开发自测报告

- 日期：2026-08-17
- Change：split-capability-hub-service-by-domain
- npm test: PASS（1627 pass / 0 fail）
- npm run lint: PASS（architecture ok，无 capability-hub-service WARN）
- 定向测试: PASS（41/41 capability-hub 相关）
- 手动冒烟: 未执行（纯重构，单元测试覆盖 IPC 注册与行为）

## 行数

| 文件 | 行数 |
|------|------|
| capability-hub-service.ts | 171 |
| capability-hub/map.ts | 368 |
| capability-hub/runtime.ts | 129 |
| capability-hub/lifecycle.ts | 547 |
| capability-hub/experts.ts | 255 |
| capability-hub/session-context.ts | 145 |
| capability-hub/ipc.ts | 226 |
| capability-hub-map.ts | 4 |

拆分前 service 约 1699 行 → 组合根 171 行。

## 备注

- `tests/skill-task-catalog.test.js` 更新 IPC 源文件断言为 `capability-hub/ipc.ts`（通道名未变）。
