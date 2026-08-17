# Acceptance: split-capability-hub-service-by-domain

## 验收项

- [x] `require('./capability-hub-service')` 导出符号不变（IPC_CHANNELS、createCapabilityHubService、map*、createMinimalPackage、projectSessionKnowledge 等）
- [x] `capability-hub-map.ts` 兼容 re-export，测试映射行为一致
- [x] 组合根 ≤900 行（实际 171 行）
- [x] 各域文件 ≤1200 行（最大 lifecycle 547 行）
- [x] IPC 通道名未改
- [x] npm test / npm run lint 通过

## 制作人体验（可选）

- 能力 Hub 列表、收藏、专家 save 由集成测试覆盖；未做 UI 手测。
