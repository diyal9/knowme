## 架构

| 层 | 职责 |
|---|---|
| 渲染 `workspace.js` | 织网结构总览、检索台、织网提案审核 |
| preload | `fabricQuery`、`fabricGraph`、`kbMount`、`knowledgeExport/Import` |
| 主进程 IPC | 薄 handler，委托 `src/lib/fabric-*.js` |
| 逻辑 | `fabric-graph` / `fabric-weave` / `fabric-retrieval` / `qmd-engine` |

## 性能

- 根检索仅扫描 graph 节点摘要 + wiki 索引（≤2000 文件上限沿用 knowledge-os）
- 外挂扇出按 routing 选择性触发，非全库并发
- qmd 子进程 12s 超时；默认不走 qmd

## 安全

- 渲染进程无 fs；织网/检索经 IPC
- remote-rag apiKey 仍加密存储，日志不泄露

## qmd 决策

- Feature flag `KNOWME_QMD=1` 才探测 CLI
- 不可用时 **不阻塞**：`knowledge-rank` + 可选 `buildEmbedFn` 重排
