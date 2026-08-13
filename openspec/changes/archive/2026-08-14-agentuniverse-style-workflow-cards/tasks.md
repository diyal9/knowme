## 1. Canvas projection

- [x] 1.1 在 `workbench-studio-canvas.js` 增加 `sectionsFromNode` / 动态 `sizeForNode`
- [x] 1.2 `visualNodeFromDraft` 挂上 `sections`，并传入 draft IO（start/end）
- [x] 1.3 扩大执行类节点默认宽高下限，限制总高度上限

## 2. Studio UI

- [x] 2.1 重写 `studioCanvasNodeHtml` 分节渲染（section title + rows / text）
- [x] 2.2 CSS：分节块、表格式 IO 行、图标色、冷蓝边线
- [x] 2.3 开始/结束节点从 draft.inputs/outputs 投影分节

## 3. Verify

- [x] 3.1 单测：sections 存在、关键 kind 校验、尺寸下限
- [x] 3.2 `npm test` + `npm run lint`（本 change 相关全绿）
- [x] 3.3 写 `evidence/dev-self-test.md`

## 4. Gate artifacts

- [x] 4.1 `qa-plan.md` Smoke Scope
- [x] 4.2 `acceptance.md` 制作人清单

## 5. 节点内轻量编辑

- [x] 5.1 `fieldsFromNode` 投影可编辑 bind（name / intent / prompt / IO / condition…）
- [x] 5.2 画布渲染 input/textarea/select；拖动与连线不抢表单焦点
- [x] 5.3 `applyStudioInlineField` 写入 draft，输入过程不整图重绘
- [x] 5.4 失焦/选择变更时与右侧 Inspector 同步
- [x] 5.5 单测 + 证据更新
