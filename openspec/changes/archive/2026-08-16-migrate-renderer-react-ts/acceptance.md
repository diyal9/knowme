# Acceptance — migrate-renderer-react-ts

## 制作人清单

- [ ] 仅架构替换，无故意产品变更
- [x] 默认 React 入口；无法回落到 LegacyHost
- [ ] rail / 货架 / 助理 / run 与 Demo 对照通过
- [ ] 设置等次要窗可开
- [x] 页面级 legacy html/js 已从 `src/` 移除（Wave2-F）；运行时不加载

## 退役说明（Wave2-F）

已从 `src/` 删除并由 Vite/React 接管的页面壳：

- `workspace.html` / `workspace.js` / `workspace-agent.js` / `workbench.js`
- `capability-hub.html` / `capability-hub.js` / `capability-hub.css`
- `settings.html` / `list.html` / `memory.html` / `note.html`
- `log-viewer.html` / `log-viewer.js`
- `editor-pane.html` / `editor-pane.js`

**仍保留于 `src/`（运行时加载）**：`attention-toast.html`（桌面通知 IPC）。

L0 静态契约测试：legacy 快照在 `tests/fixtures/legacy-pages/`；新契约断言指向 `src/renderer/**` 与 `src/domain/**`。

## 结论

- 结果：开发自测完成（Wave2-F 退役 + 1882/1882 test + lint PASS），待制作人签字
- 日期：2026-08-14
