## 1. 步骤微卡分区结构

- [x] 1.1 将 `wb-daemon-review-step-card` 拆为 `wb-daemon-review-step-head`（主标题）与可选 `wb-daemon-review-step-body`（英文名、产出）
- [x] 1.2 更新 `workbench-layout.css`：白底卡 + 标题栏底色（默认/当前/错误）+ zigzag 对齐

## 2. 测试与自测

- [x] 2.1 更新 `tests/workbench-templates.test.js` 断言 head/body class
- [x] 2.2 `npm test` + `npm run lint` 通过；写 `evidence/dev-self-test.md`
