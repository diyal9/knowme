# 开发自测报告

- 日期：2026-08-12
- Change：soften-expert-card-enter-once
- npm test: PASS（1692/1692）
- npm run lint: PASS
- 手动冒烟: 待制作人确认（入场减弱 + 切页不重播）
- 备注：
  - `hub-rise` / `wb-task-quick-rise`：opacity 0.92、translateY 3px、240ms、stagger 20ms/cap 120ms
  - 仅容器 `.is-entering` 时播放；会话内 flag 防重播
  - iframe 冷加载专家库仍会播一次（符合「首次加载」）
