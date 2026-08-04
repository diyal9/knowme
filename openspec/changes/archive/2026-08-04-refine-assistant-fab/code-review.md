# Code Review: refine-assistant-fab

- 日期：2026-08-04
- 审查者：开发（Developer）
- 审查范围：悬浮助理 FAB 视觉收敛、定位与持久化；`src/workspace.html` 内联 CSS / SVG / 脚本
- 对照工件：`proposal.md`、`design.md`、`specs/workspace/spec.md`、`tasks.md`
- 结论：**通过（无 BLOCKING）** — 实现与 OpenSpec 一致，硬门禁全绿；可进入制作人验收

## 变更范围

| 文件 | 变更性质 |
|------|----------|
| `src/workspace.html` | FAB 样式（`#km-fab-*`）、内联 SVG、`initKnowMeFab` 脚本 |
| `openspec/changes/refine-assistant-fab/*` | proposal / design / spec / tasks / evidence |

**未触及**：主进程、preload、IPC、Capability Hub 页面、`workspace-agent.js`、`agent-presence.js` 逻辑（仅继续集成）。

## Spec 对照

| 要求 | 实现 | 状态 |
|------|------|------|
| 默认右下角单一聊天标记，无常驻药丸底板/厚阴影 | 按钮 `background: transparent; box-shadow: none`，SVG `currentColor` | ✅ |
| 浅色/深色主题可识别 | 浅色 `#26384d`，深色 `#f4efe7` + 悬停 `drop-shadow` | ✅ |
| 悬停、焦点、处理中反馈 | `:hover` 位移+投影、`focus-visible` 描边、`.processing` 光环 | ✅ |
| 点击展开快捷面板 | `toggle()` + `placePanel()` | ✅ |
| 纵向拖动并持久化 | pointer 拖动 + `knowme.fab.pos.v2` | ✅ |
| 可恢复工作提示与徽标 | `#km-fab-resume` / `#km-fab-badge` 逻辑未改 | ✅ |
| 旧贴边位置不覆盖新默认 | v2 键隔离，不读 v1 | ✅ |
| 右侧安全边距 | CSS `right: 14px`，JS `RIGHT_MARGIN = 14` | ✅ |

## 重点审查

### 1. 样式作用域

- 所有 FAB 规则均通过 `#km-fab-root`、`#km-fab-btn`、`#km-fab-panel` 及 `.km-fab-*` 子选择器限定，未引入全局类名污染。
- 内联 `<style>` 块自包含于 FAB 注释段，与 Agent / Workbench / Capability Rail 样式隔离良好。
- `-webkit-app-region: no-drag` 保留，避免 Electron 窗口拖拽与 FAB 拖动冲突。

### 2. 主题

- 气泡主体改为 `fill="currentColor"`，状态点固定 `#f05d4e`，符合 design §1。
- 深色主题通过 `@media (prefers-color-scheme: dark)` 覆盖按钮前景色、面板背景/边框/文字；面板内 avatar 仍用渐变底板（仅展开态可见，可接受）。
- 徽标边框使用 `var(--bg-card, #fff)`，与 workspace 主题变量衔接。

### 3. 无障碍

| 项 | 评价 |
|----|------|
| 按钮 `aria-label` / `aria-haspopup` / `aria-expanded` | ✅ 完整 |
| 面板 `role="menu"`、项 `role="menuitem"` | ✅ |
| `:focus-visible` 2px 描边 | ✅ |
| `prefers-reduced-motion` 关闭光环与 presence 动画 | ✅ |
| 可恢复 Session 时 `aria-label` 升级为「有可恢复工作」 | ✅ |
| `aria-controls` 关联面板 | ⚠️ 缺失（建议后续补，非阻塞） |
| 面板内方向键导航 | ⚠️ 未实现（既有行为，非本 change 引入） |

**ADVISORY**：`agent-presence.js` 的 `apply()` 在 `thinking` 态会将 `aria-label` 设为「正在处理」，可能覆盖 `renderResumeSuggestion` 写入的「有可恢复工作」文案。两模块未协调优先级——属既有集成问题，本 change 未恶化，建议后续 Story 统一 label 合成逻辑。

### 4. 拖动 / 点击冲突

- `pointerdown` → `setPointerCapture` → `pointermove`/`pointerup`/`pointercancel` 链路完整。
- `DRAG_THRESHOLD = 4` px，`moved` 标志在 `click` 时短路，避免拖完误触面板。
- 拖动开始时 `close()` 关闭面板，`dragging` 类禁用 transition，体验合理。
- `touch-action: none` 防止移动端滚动干扰。

### 5. localStorage v2

```javascript
const POS_KEY = 'knowme.fab.pos.v2'
// 仅存 { top }；applyTop 始终强制 right: 14px
```

- 与 design §3 一致：v1 不再读取，首次展示 CSS 默认锚点（`right: 14px; bottom: 18px`）。
- 拖动后 `savePos(applyTop(...))` 写入 v2；`resize` 时重新钳制并保存。
- **测试缺口**：无静态断言覆盖 `knowme.fab.pos.v2` 键名或 `RIGHT_MARGIN` 常量（见下文）。

### 6. 右边距与面板定位

- 默认：`position: fixed; right: 14px; bottom: 18px`。
- 拖动后：`applyTop()` 切换为 `top` + `right: 14px`，清除 `bottom`，纵向钳制 `[MARGIN, innerHeight-h-MARGIN]`。
- `placePanel()`：面板始终从图标左侧弹出（`panel.style.right = r.width + 10`），`r.top < 300` 时改向上对齐，避免顶出视口。

### 7. 状态光环

- **处理光环**：`.processing` 类由 `MutationObserver` 监听 `#agentComposerMeta.busy` 与 `#agentSend.is-running` 同步，仅真实生成时触发 `::after` 动画——符合注释「真实处理中才显示」。
- **Presence 动画**：`data-presence-state` 驱动 glyph 微动；`.presence-disabled` 强制关闭 `::after` 光环，与 processing 语义分离。
- `@media (prefers-reduced-motion: reduce)` 同时关闭两类动画。

### 8. Capability Hub / Agent UI 回归

| 区域 | 影响 |
|------|------|
| Capability Rail / Hub drawer | 无代码变更；`workspace-capability-rail.test.js` 4/4 PASS |
| Agent Session / Resume | `#km-fab-resume`、`data-fab-resume`、`WorkspaceAgent.resumeSession` 契约保持 |
| Agent Presence | `lib/agent-presence.js` 加载与 `createPresenceController({ root, button })` 集成未改 |
| Composer / 待办 / 日志 IPC | `knowme:add-todo`、`openLogsWindow`、`openLogsDir` 调用链未变 |
| `workspace-agent.js` | 无 diff |

**ADVISORY**：FAB `z-index: 9000` 高于 Capability Hub 全屏 drawer（`z-index: 220`）及 link-preview（`3000`），Hub 打开时 FAB 仍浮于最上层。符合「助理随时可达」产品意图，但可能遮挡 Hub 右下角控件——制作人验收时建议在 Hub 全屏态目测一次。

## 风险

| 级别 | 风险 | 缓解 / 建议 |
|------|------|-------------|
| ADVISORY | v1 位置不再读取，老用户首次升级会回到默认右下角 | design 已说明；可拖动后立即保存 v2 |
| ADVISORY | 无针对本 change 的专项静态测试（v2 键、透明按钮、边距常量） | 后续可在 `workspace-agent.test.js` 补 3–4 条字符串契约 |
| ADVISORY | `evidence/dev-self-test.md` 引用截图路径但 `evidence/screenshots/` 目录尚未提交 | 制作人验收前补 `fab-closed.png` / `fab-open.png` |
| ADVISORY | presence 与 resume 的 `aria-label` 可能互相覆盖 | 非阻塞；后续统一 label 策略 |
| ADVISORY | Hub 全屏时 FAB 仍置顶 | 验收时目测；若产品要求 Hub 态隐藏 FAB 需另开 Story |

**BLOCKING**：无。

## 测试证据

| 检查 | 结果 | 说明 |
|------|------|------|
| `npm test` | **885/885 PASS** | 含 `workspace-agent.test.js`（29）、`workspace-capability-rail.test.js`（4）、`agent-presence.test.js` |
| `npm run lint` | **PASS** | lint + script-scope |
| 开发自测 | PASS | `evidence/dev-self-test.md` |
| 相关静态断言 | 部分覆盖 | resume 宿主、`km-fab-presence-idle`、`prefers-reduced-motion` 等 |

审查时独立复跑：`npm test` 885/885、`npm run lint` PASS（2026-08-04）。

## 结论与建议

实现严格遵循 proposal / design / delta spec，tasks 全部勾选合理。变更边界清晰（仅渲染层），对 Capability Hub 与 Agent UI 无功能性回归。硬门禁通过，**建议进入制作人体验验收**。

**非阻塞跟进（可选）**：

1. 补 `evidence/screenshots/fab-closed.png`、`fab-open.png`
2. 静态测试：`knowme.fab.pos.v2`、`background: transparent`、`RIGHT_MARGIN = 14`
3. 统一 FAB `aria-label` 合成（resume > thinking > default）
