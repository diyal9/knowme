# Code Review · establish-root-knowledge-fabric（返工）

## 结论

通过。测试角色 Blocking/Major 项已修复，织网闭环可在 UI 完整走通。

## Blocking 根因与改法

- **根因**：`fabricWeaveRun` 在 `await fabricWeaveRun` 后调用 `openKnowledgeOsPanel` 重建 DOM，原 `e.currentTarget`  detached → `disabled` 赋值抛错，按钮永久 disabled。
- **改法**：新增 `runAsyncKnowledgeButton(button, labels, task)`，await 前缓存按钮引用，`finally` 中检查 `button.isConnected` 再恢复。

## Major 根因与改法

- **根因**：`fabricHitRowsHtml([])` 不区分「未检索」与「已检索无命中」。
- **改法**：`fabricSearchAttempted` + `{ searched: true }` 渲染「未找到相关知识」空态及连接/吸收/织网入口。

## 冒烟覆盖

Electron smoke 已覆盖：织入→提案→拒绝→再织入→确认；无结果检索空态。

## 残留风险

- 其它知识面板 async 按钮（如 remote RAG 测试）未全部迁移到 helper，后续可统一。
