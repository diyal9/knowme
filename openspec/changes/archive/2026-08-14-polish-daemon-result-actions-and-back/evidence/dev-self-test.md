# Dev self-test — polish-daemon-result-actions-and-back

## 改动

- `src/workbench-shelf.css`：`.wb-run-result-actions` → `justify-content:center` + `flex-wrap`
- `src/workbench.js`：
  - `backDaemonRunToPipelineTasks()`：顶栏返回固定 `surface:'daemon'` → `openManagePanel('daemon')`
  - `backRunResultToShelf()`：「回到货架」固定回 shelf
  - `#wbRunBack`：`run.mode==='daemon'` 走管线任务；否则 `backToRunList`
- HITL：既有 `daemon-hitl` 对话卡未回退（契约仍断言 `syncDaemonHitlFromContext` / `knowme-daemon-hitl-submitted`）

## 自测

- [x] 契约测试断言居中与分流
- [x] `npm test` **1786** 通过；`npm run lint` 通过
- [ ] 人工：结果页按钮居中；顶栏返回→管线任务；「回到货架」→货架
