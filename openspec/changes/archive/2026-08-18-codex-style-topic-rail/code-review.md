# Code review — codex-style-topic-rail

结论：通过。主题轨只负责锚点与预览；滚动条在 pane chrome。长列表用 index 比估算 offset，避免 Virtuoso 未挂载 DOM 对不齐。

- 单测：`wave9-parity.spec.ts`、`assistant.spec.tsx`
- 无新 IPC
