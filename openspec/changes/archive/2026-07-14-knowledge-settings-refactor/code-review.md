# Code Review: knowledge-settings-refactor

## 范围

- `src/lib/product-knowledge.js`（选择性导出、`readConcept`）
- `src/main.js` / `src/preload.js`
- `src/settings.html`
- `tests/product-knowledge.test.js`

## 结论

- **PASS**
- 空选拒绝 vs 全选整包边界清晰
- 预览与实例化分离，符合反误触
- 设置页文案与布局明显收敛

## 后续建议（非阻塞）

- 预览可用轻量 Markdown 渲染（当前纯文本更稳）
