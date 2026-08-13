## 1. Canvas summary model

- [x] 1.1 调整 `workbench-studio-canvas.js`：节点投影改为只读 `sections` 摘要（含专家名/未绑定、知识库、技能、条件等），不再向画布输出可编辑 `fields`
- [x] 1.2 重算 `sizeForNode` 使摘要卡默认高度明显低于内联表单版

## 2. Workbench render & events

- [x] 2.1 `studioCanvasNodeHtml` 仅渲染只读标题与 sections；移除卡片上 input/select/textarea（含 inline title）
- [x] 2.2 移除或停用画布 `data-studio-inline` 变更/焦点事件路径，避免死代码误用
- [x] 2.3 确认 Inspector 仍完整可编（名称、执行专家、知识库、技能、Prompt、条件、IO），改后卡片摘要同步

## 3. Style & copy

- [x] 3.1 摘要卡 CSS：紧凑分区、未绑定弱警示；去掉 `is-editable` 表单态样式依赖
- [x] 3.2 属性面板 idle 文案强调「点选节点后在右侧配置」

## 4. Tests & self-check

- [x] 4.1 更新 `tests/workbench-studio-canvas.test.js`（及任何断言卡片含 select-expert / inline 的用例）为摘要契约
- [x] 4.2 `npm test && npm run lint`；本地打开编排画布自测知识库节点；写 `evidence/dev-self-test.md`
