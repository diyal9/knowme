# 测试报告: refine-assistant-fab

- **日期**：2026-08-04
- **测试人**：测试（Tester）
- **接入前提**：开发自测 PASS + 制作人 `acceptance.md` PASS
- **验证方式图例**：✅ 已实测 / 静态已证实 · 📷 截图复核 · ⚙️ 静态契约 · 🔜 NOT RUN（当前环境无法完成，非阻塞）

---

## 门禁

| 级别 | 检查项 | 结果 | 说明 |
|------|--------|------|------|
| 硬 | `npm test` | **PASS** | 885/885（QA 独立复跑） |
| 硬 | `npm run lint` | **PASS** | lint ok / script-scope ok |
| 硬 | `harness:gate` | **PASS** | `ok=true`, `blocking=false` |
| 软 | qa-plan Smoke Scope | **已执行** | 见下文；部分项 🔜 NOT RUN |
| 软 | code-review.md | **已完成** | 无 BLOCKING |
| 软 | 制作人 acceptance | **PASS** | 2026-08-04 |

---

## Smoke 结果

### 默认呈现与低打扰

| 用例 | 结果 | 备注 |
|------|------|------|
| 首次打开仅见聊天图标，无药丸底板/厚阴影 | ✅ 📷⚙️ | `fab-closed.png`：透明底、无实心容器；CSS `background: transparent; box-shadow: none; ::before { content: none }` |
| 距右 ~14px、距底 ~18px | ✅ 📷⚙️ | 截图边距与 `#km-fab-root { right:14px; bottom:18px }` 一致 |
| 30px 可视 / 36px 热区；珊瑚状态点可见 | ✅ 📷⚙️ | SVG 30×30、按钮 36×36；截图可见 `#f05d4e` 状态点 |
| 长时间挂屏无额外动画（非 processing） | 🔜 NOT RUN | 需 ≥30min Electron 真机观测；常态无 `@keyframes` 常驻动画（仅 hover/presence/processing 触发）— **ADVISORY，非阻塞** |

### 主题与交互反馈

| 用例 | 结果 | 备注 |
|------|------|------|
| 浅色主题图标清晰（`#26384d`） | ✅ 📷⚙️ | `fab-closed.png` / `fab-open.png` 在暖灰工作台上对比充足 |
| 深色主题图标清晰（`#f4efe7`） | 🔜 NOT RUN | CSS `@media (prefers-color-scheme: dark)` 已定义；**无 `fab-dark-closed.png`** — **ADVISORY，非阻塞** |
| 悬停：上移/缩放 + 图标投影，无实心容器 | ⚙️ 静态 PASS | CSS `:hover` transform + `.km-fab-glyph` drop-shadow；真机 hover 🔜 |
| Tab 聚焦 + Enter/Space 展开 | ⚙️ 静态 PASS | `focus-visible` 2px 轮廓已定义；键盘交互 🔜 NOT RUN |
| Agent 运行中 processing 珊瑚光环 | ⚙️ 静态 PASS | `syncProcessingState` + `.processing #km-fab-btn::after`；真机动画 🔜 NOT RUN |

### 展开与面板（不退化）

| 用例 | 结果 | 备注 |
|------|------|------|
| 单击展开快捷面板（KnowMe 助理 + 三项菜单） | ✅ 📷⚙️ | `fab-open.png`：头区 + 加入待办 / 日志中心 / 日志目录 |
| 「加入待办」有/无主题行为 | 🔜 NOT RUN | 脚本 `currentTopic()` + `knowme:add-todo` 存在；需 Electron IPC 真机 |
| 「日志中心」「日志目录」打开并关面板 | 🔜 NOT RUN | 事件绑定存在；需 Electron 真机 |
| 可恢复 Session 卡 + 角标「1」 | ⚙️ 静态 PASS | `#km-fab-resume` / `#km-fab-badge` / `renderResumeSuggestion` 完整；真机 Session 数据 🔜 |
| Esc / 点外部 / 选菜单项关闭 | ⚙️ 静态 PASS | `keydown Escape`、`document.click`、`close()` 链路保留；交互 🔜 |

### 拖动与位置持久化

| 用例 | 结果 | 备注 |
|------|------|------|
| 纵向拖动 >4px 不展开；松手保存 | ⚙️ 静态 PASS | `DRAG_THRESHOLD=4`、`moved` 短路 `click`；真机拖动 🔜 |
| 拖动全程右侧 ~14px | ⚙️ 静态 PASS | `applyTop()` 强制 `RIGHT_MARGIN=14` |
| 重启/刷新恢复纵向位置 | 🔜 NOT RUN | `knowme.fab.pos.v2` 读写逻辑存在；需 Electron 重启 |
| resize 后仍在可视范围 | ⚙️ 静态 PASS | `resize` 监听 + `clamp(MARGIN, maxT)` |
| 旧键 v1 不影响新默认 | ✅ ⚙️ | 代码仅 `POS_KEY='knowme.fab.pos.v2'`，不读取 v1 |

---

## Regression 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| `npm test` 全通过 | ✅ | 885/885 |
| `workspace-agent.test.js` 29/29 | ✅ | 含 resume 宿主、presence、reduced-motion 断言 |
| `npm run lint` | ✅ | PASS |
| Agent Tab / composer / 流式 / presence 不退化 | ✅ ⚙️ | 定向测试 + 静态契约 |
| 悬浮助理 IPC 无新增 console error | 🔜 NOT RUN | 需 Electron 运行时 |
| `prefers-reduced-motion: reduce` 关闭 processing/presence 动画 | ✅ ⚙️ | CSS 媒体查询覆盖 `#km-fab-root.processing` 与 presence glyph |

---

## 反模式审查（重点）

| 反模式 | 结果 | 发现 |
|--------|------|------|
| **可发现性**：低打扰图标是否仍能找到 | ✅ 📷 | 右下角常规锚点 + 珊瑚状态点；浅色背景下 `#26384d` 对比足够；无药丸后视觉更轻但仍可辨 |
| **点击/拖动冲突** | ✅ ⚙️ | 4px 阈值 + `moved` 阻止拖后 click；拖动时 `close()` 关面板 |
| **右边距** | ✅ 📷⚙️ | 默认与 JS 均 14px；截图未贴边 |
| **面板裁切** | ✅ 📷⚙️ | `fab-open.png` 面板完整；`placePanel()` 在 `r.top < 300` 时改向上对齐 |
| **z-index 与 Hub** | ✅ ⚙️ ADVISORY | FAB `z-index:9000` > Hub drawer `220`；FAB 在 Hub 全屏态仍置顶——符合「助理随时可达」意图，Hub 右下角可能被挡 — **ADVISORY，非阻塞** |
| **aria-label 覆盖** | ⚙️ ADVISORY | 默认/可恢复：`KnowMe 助理` / `KnowMe 助理，有可恢复工作` ✅；`agent-presence.js` 在 `thinking` 时写 `正在处理`，可能覆盖 resume 文案（code-review 已记，既有问题，本 change 未恶化）— **ADVISORY，非阻塞** |
| 工作台滚动 FAB 不漂移 | ⚙️ | `position: fixed`；真机滚动 🔜 |
| 复杂背景对比 | ✅ 📷 ADVISORY | 浅色工作台 + 输入区背景可读；深色卡片/图片背景 🔜 |
| 多显示器 / DPI 125%·150% | 🔜 NOT RUN | **ADVISORY，非阻塞** |
| v1 用户升级首启回默认 | ✅ ⚙️ | v2 键隔离；拖动一次可重新固化 |

---

## 截图证据

| 文件 | 状态 | 用途 |
|------|------|------|
| `screenshots/fab-closed.png` | ✅ 已复核 | 浅色收起：透明图标锚点、右下边距、珊瑚点 |
| `screenshots/fab-open.png` | ✅ 已复核 | 浅色展开：面板 IA 完整、自图标左侧弹出、无裁切 |
| `screenshots/fab-dark-closed.png` | 🔜 未提供 | QA 环境未跑深色真机 |
| `screenshots/fab-processing.png` | 🔜 未提供 | QA 环境未触发 Agent 运行态 |

---

## 反模式发现详情

### [ADVISORY] presence 与 resume 的 aria-label 可能互相覆盖

- **反模式**：可恢复 Session 存在时，Agent 进入 thinking 态
- **预期**：屏幕阅读器应同时感知「有可恢复工作」或「正在处理」
- **实际**：`renderResumeSuggestion` 写 `有可恢复工作`；`agent-presence.js` `apply()` 在 thinking 时覆盖为 `正在处理`
- **证据**：`src/lib/agent-presence.js` L89；code-review §3
- **阻塞**：否（既有集成问题，非本 change 引入）

### [ADVISORY] Hub 全屏时 FAB 仍浮于最上层

- **反模式**：打开 Capability Hub 全屏 drawer
- **预期**：Hub 控件不被遮挡（视产品策略）
- **实际**：FAB z-index 9000 > Hub 220，FAB 仍可见可点
- **证据**：静态 z-index 对比；code-review §8
- **阻塞**：否（符合 design「随时可达」；若需 Hub 态隐藏 FAB 应另开 Story）

### [ADVISORY] 深色主题 / processing 光环 / DPI 未在本轮真机补证

- **说明**：CSS 与脚本契约已静态 PASS；缺少 `fab-dark-closed.png`、`fab-processing.png` 与多 DPI 实测
- **阻塞**：否（制作人已标注 🔜 移交 QA；不阻碍 Story 完成）

---

## 静态契约抽检（25/25 PASS）

QA 独立运行 `workspace.html` 字符串契约脚本：POS_KEY v2、透明按钮、14/18px 边距、36/30px 尺寸、DRAG_THRESHOLD/RIGHT_MARGIN、aria 属性、z-index、placePanel、reduced-motion、processing 同步等全部 PASS。

---

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**BLOCKING 问题：无**

**ADVISORY 跟进（可选，不阻塞归档）**：

1. 补 `fab-dark-closed.png`、`fab-processing.png`（真机 Electron）
2. DPI 125%/150% 与 Hub 全屏叠层目测
3. 后续 Story 统一 FAB `aria-label` 合成优先级（resume > thinking > default）

证据目录：`evidence/screenshots/`
