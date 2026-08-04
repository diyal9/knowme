# QA Plan: refine-assistant-fab

## Smoke Scope（必填）

### 默认呈现与低打扰

- [x] 首次打开工作台（或清空 `knowme.fab.pos.v2`）→ 右下角仅见聊天图标，无药丸底板、无常驻厚阴影 — ✅ QA：截图 `fab-closed.png` + 静态 CSS
- [x] 图标距窗口右缘约 14px、距底约 18px，不贴边 — ✅ QA：截图 + `#km-fab-root { right:14px; bottom:18px }`
- [x] 图标约 30px 可视、36px 可点；珊瑚状态点可见 — ✅ QA：截图 + CSS/ SVG 尺寸
- [ ] 长时间挂屏（≥30min）图标不引入额外动画或闪烁（非 processing 态）— 🔜 NOT RUN（ADVISORY，非阻塞）

### 主题与交互反馈

- [x] 浅色系统主题下图标清晰可辨（深蓝灰 `#26384d` 量级）— ✅ QA：`fab-closed.png` / `fab-open.png`
- [ ] 深色系统主题下图标清晰可辨（暖白 `#f4efe7` 量级），背景仍透明 — 🔜 NOT RUN（CSS 已定义；缺 `fab-dark-closed.png`，ADVISORY）
- [ ] 鼠标悬停：轻微上移/缩放 + 图标投影，无实心容器出现 — ⚙️ 静态 PASS；真机 hover 🔜
- [ ] Tab 聚焦 FAB：可见 focus 轮廓；Enter/Space 可展开面板 — ⚙️ 静态 PASS（`:focus-visible`）；键盘 🔜
- [ ] Agent 发送/流式运行中：FAB 显示 processing 珊瑚光环；结束后消失 — ⚙️ 静态 PASS（`syncProcessingState`）；真机动画 🔜

### 展开与面板（不退化）

- [x] 单击 FAB → 快捷面板从图标左侧展开，含「KnowMe 助理」头与三项菜单 — ✅ QA：`fab-open.png`
- [ ] 「加入待办」：有主题时写入待办并 toast；无主题时提示先输入 — 🔜 NOT RUN（需 Electron IPC）
- [ ] 「日志中心」「日志目录」：分别打开对应窗口/目录，面板关闭 — 🔜 NOT RUN（需 Electron IPC）
- [ ] 存在可恢复 Session 时：面板内「继续工作」卡 + 角标「1」；恢复/暂不行为正常 — ⚙️ 静态 PASS；真机 Session 🔜
- [x] Esc、点击面板外、选菜单项后面板关闭；再次点击 FAB 可重新打开 — ⚙️ 静态 PASS（事件监听完整）；交互 🔜

### 拖动与位置持久化

- [x] 纵向拖动 FAB（>4px）→ 不触发展开；松手后位置保存 — ⚙️ 静态 PASS（`DRAG_THRESHOLD=4` + `moved`  guard）
- [x] 拖动全程右侧保持 ~14px 边距，不可横向拖离 — ⚙️ 静态 PASS（`RIGHT_MARGIN=14`）
- [ ] 重启工作台 / 刷新 → 恢复上次纵向位置 — 🔜 NOT RUN（需 Electron 重启）
- [x] 窗口 resize 后 FAB 仍在可视范围内（上下钳制）— ⚙️ 静态 PASS（`resize` + `clamp`）
- [x] 旧键 `knowme.fab.pos.v1` 存在时不影响新默认（仍用 v2 或 CSS 默认）— ✅ QA：仅读取 `knowme.fab.pos.v2`

## Regression Scope

- [x] `npm test` 全通过（含 `workspace-agent.test.js` 29/29）— ✅ QA：885/885
- [x] `npm run lint` 无 error — ✅ QA：PASS
- [x] Agent Session Tab、composer、流式回复、presence 动画不退化 — ✅ QA：定向测试 + 静态
- [ ] 悬浮助理 IPC（日志、待办 dispatch）无新增 console error — 🔜 NOT RUN（需 Electron）
- [x] `prefers-reduced-motion: reduce` 下 processing/presence 动画关闭 — ⚙️ 静态 PASS

## Anti-pattern Checks（交给测试）

- [x] 拖动结束后误触不应反复开关面板（click 与 drag 阈值 4px）— ⚙️ 静态 PASS
- [x] 面板靠近视口顶部/底部时 `placePanel` 自适应，不裁切菜单 — ✅ QA：截图无裁切 + `placePanel()` 逻辑
- [ ] 工作台内容区滚动时 FAB 固定定位不漂移、不遮挡关键 footer 控件 — ⚙️ `position:fixed`；滚动真机 🔜
- [x] 复杂背景（图片/深色卡片）上图标对比仍可读；必要时记录 advisory — ✅ 浅色工作台可读；深色卡片 🔜 ADVISORY
- [ ] 多显示器 / DPI 125% / 150% 下安全边距与热区仍合理 — 🔜 NOT RUN（ADVISORY）
- [x] 旧用户 v1 贴边习惯：升级后首启回到新默认，拖动一次即可重新固化 — ⚙️ 静态 PASS

## 证据要求

| 产物 | 路径 |
|------|------|
| 开发自测 | `evidence/dev-self-test.md` |
| UI 截图 | `evidence/screenshots/fab-closed.png`（浅色收起）✅ |
| UI 截图 | `evidence/screenshots/fab-open.png`（浅色展开）✅ |
| UI 截图 | `evidence/screenshots/fab-dark-closed.png`（深色，QA 补）🔜 |
| UI 截图 | `evidence/screenshots/fab-processing.png`（运行中光环，QA 补）🔜 |
| 测试报告 | `evidence/test-report.md` ✅ |
| 代码审查 | `code-review.md`（可选）✅ |
| 制作人验收 | `acceptance.md` ✅ |

## 门禁

- [x] `/gate-check` 或 `npm run harness:gate` → `ok=true`, `blocking=false` — ✅ QA 复跑 PASS
