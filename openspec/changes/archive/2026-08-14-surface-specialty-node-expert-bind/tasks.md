## 1. Canvas fields

- [x] 1.1 `fieldsFromNode`：`llm|tool|knowledge` 增加 `select-expert` / `agentPackageId`
- [x] 1.2 `sizeForNode` 将 `select-expert` 计入高度

## 2. Workbench wiring

- [x] 2.1 `studioCanvasFieldControlHtml` 渲染 `select-expert`
- [x] 2.2 调色板添加 specialty 节点时预填默认本地专家

## 3. Verify

- [x] 3.1 更新 `tests/workbench-studio-canvas.test.js`
- [x] 3.2 `npm test` + `npm run lint`；写 `evidence/dev-self-test.md`
