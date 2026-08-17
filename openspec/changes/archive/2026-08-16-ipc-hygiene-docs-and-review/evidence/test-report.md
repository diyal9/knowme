# Test report — architecture sweep

## 硬门禁

- `npm test` PASS
- `npm run lint` PASS
- `npm run typecheck:renderer` PASS
- `npm run typecheck:lib` PASS
- `npm run test:renderer` 179 PASS
- `npm run harness:gate` PASS（blocking）
- `npm run test:e2e` 9 PASS（Vite preview / dist）

## Smoke

货架网格、任务协作入口、Studio 进出、设置内嵌、助理空态 composer、管线 compose 提交按钮。

浏览器预览无 Electron IPC，发送消息不保证落库；Electron `npm start` 仍用于真机生成。
