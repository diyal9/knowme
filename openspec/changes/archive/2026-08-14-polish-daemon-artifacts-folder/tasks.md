## 1. 投影与契约

- [x] 1.1 在 `workbench-daemon-review.js` 增加 `artifactEmptyState(status)`（失败 / 进行中 / 成功或其它）并导出
- [x] 1.2 单测覆盖空态文案区分与非空制品投影不变

## 2. 制品 Tab UI

- [x] 2.1 重写 `renderDaemonReviewBody('artifacts')`：空态图标面板；有文件时文件夹式行（图标、名、尺寸、操作）
- [x] 2.2 空态不渲染「点击预览」tip；有文件时保留简短 tip；空态提供切到「步骤」的入口
- [x] 2.3 更新 `workbench-layout.css` 制品空态与文件行样式（无卡套卡）

## 3. 自测

- [x] 3.1 `npm test` 与 `npm run lint` 通过并记录证据
