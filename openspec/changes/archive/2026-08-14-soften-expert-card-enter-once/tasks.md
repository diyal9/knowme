## 1. CSS 减弱 + 门控

- [x] 1.1 专家库：`hub-rise` 减弱；仅 `.is-entering` 下 featured/grid 卡片播放
- [x] 1.2 工作台：`wb-task-quick-rise` 减弱；仅 `.is-entering` 下播放；保留 reduced-motion

## 2. JS 仅首次

- [x] 2.1 `capability-hub.js`：首次真实卡片渲染后给 featured/grid 加 `is-entering`，结束后移除，flag 防重播
- [x] 2.2 `workbench.js`：`renderTaskHome` 首次快捷卡同理

## 3. 自测

- [x] 3.1 lint / 相关冒烟；写 `evidence/dev-self-test.md`
