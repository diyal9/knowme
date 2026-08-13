## 1. Canvas layout module

- [x] 1.1 `workbench-studio-canvas.js`：linear 分层 / free 坐标布局与 SVG path
- [x] 1.2 单测：串行、并行+join、审批+gate；调色板类型

## 2. Free graph model

- [x] 2.1 `graphMode` / `edges` / `addNode` / `connect` / `disconnect` / `updatePosition` / `ensureFreeGraph`
- [x] 2.2 `toComposition` free 编译 specialty + condition + branch
- [x] 2.3 `fromGraph` 还原 free 与 specialty kind
- [x] 2.4 `validateDraft`：绑定专家 / skill / knowledge / 条件出边

## 3. Runtime

- [x] 3.1 `VALID_NODE_TYPES` + graph normalize 含 `condition`
- [x] 3.2 Workflow runner 条件求值与 branch skip

## 4. Studio UI

- [x] 4.1 默认专业画布 + ensureFreeGraph
- [x] 4.2 端口拖线、节点拖位、边选中删除
- [x] 4.3 调色板与各类型 Inspector
- [x] 4.4 保存路径 draftAgents + validate

## 5. Verify

- [x] 5.1 free-graph / model / canvas 单测
- [x] 5.2 `npm test` + `npm run lint` 全绿
- [x] 5.3 `evidence/dev-self-test.md` 更新
