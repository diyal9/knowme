## 1. 返回路径顺序

- [x] 1.1 `closeExpertTaskRoom`：先清 task-room 视图状态与壳层布局，再 `restoreTaskRoomReturnState`
- [x] 1.2 `setSurface`：`onPageChange` 先于 `renderShelf` / `renderTaskHome` / `renderStudio`

## 2. 货架重测

- [x] 2.1 进入 shelf 后 `requestAnimationFrame` 再 `paintShelfGrid`（仅 activeSurface 仍为 shelf）
- [x] 2.2 静态测试锁定顺序与 rAF 重绘

## 3. 自测

- [x] 3.1 `npm test` / `npm run lint`
- [ ] 3.2 手动：工作流任务房 → 返回 → 货架一行多卡（非仅 1 张）
