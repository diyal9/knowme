## 架构

```
渲染进程 workspace.js (治理 Tab)
    ↓ preload IPC
主进程 main.js
    ↓
fabric-governance.js ←→ fabric-graph.json / governance.json / governance-proposals.json
    ↑ hooks
fabric-weave / fabric-retrieval / knowledge-os.ingest
```

## 边界

| 层 | 职责 |
|---|---|
| `fabric-governance.js` | 纯 Node：体检、SSOT、提案 CRUD、重织队列 |
| `main.js` | IPC 桥接、`buildFabricCtx` 注入 providers/sources |
| `workspace.js` | 只调用 `window.api.*`，async 按钮用 `runAsyncKnowledgeButton` |

## 性能

- 联合体检：Wiki walk + OKF lint + graph 扫描，单次 <2s（500 文件上限与既有 lint 对齐）
- 重织队列：默认每次处理 1 库，避免阻塞启动；UI 手动触发
- stale 扫描：比对 syncHash/mtime，不读全文 embedding

## SSOT 默认

`governance.json.ssotMode = 'mark'`（路线图 §3 #8）。`block` 经 UI/IPC 可切换。

## 数据文件

- `fabric/governance.json` — ssotMode、dismissedIssueIds、reweaveQueue
- `fabric/governance-proposals.json` — cleanup/alias/reconcile/reweave 提案
