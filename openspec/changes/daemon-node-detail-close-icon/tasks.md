## 1. UI 结构

- [x] 1.1 将 `renderDaemonStepDetail` 中左侧「返回步骤」改为右侧关闭图标按钮（保留 `data-step-detail-back`，补充 title/aria-label）
- [x] 1.2 调整 `.wb-daemon-review-step-detail` / 关闭按钮 CSS，使图标贴右上角，与 `wb-icon-btn` 视觉一致

## 2. 测试与自检

- [x] 2.1 更新 `tests/workbench-templates.test.js` 断言（关闭图标 / 无「返回步骤」文案）
- [x] 2.2 运行 `npm test` 与 `npm run lint`，本地重启验证点击关闭回列表
