# 制作人体验验收: refine-assistant-fab

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**证据**：`evidence/dev-self-test.md`、`src/workspace.html` FAB 区块、`specs/workspace/spec.md`；硬门禁 `npm test` 885/885、`npm run lint` PASS、`workspace-agent` 29/29、Electron 启动 PASS

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 静态 UI / 代码契约 / 开发自测已证实 |
| ⚡ | Electron 启动冒烟（无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 核心路径 — 低打扰图标锚点

- [x] ✅ 默认态仅显示聊天标记（30×30 SVG + 珊瑚状态点），无实心药丸底板、无常驻厚阴影 — `#km-fab-btn` 透明背景、`box-shadow: none`、`::before { content: none }`
- [x] ✅ 点击热区 36×36 保留，不因视觉收敛而缩小可点区域 — CSS 与 design 决策 #2 一致
- [x] ✅ 默认锚点在工作台右下角，右侧 14px、底部 18px 安全边距 — `#km-fab-root { right: 14px; bottom: 18px }`
- [x] ✅ 纵向拖动后仍保持右侧 14px，位置写入 `knowme.fab.pos.v2` — `applyTop` + `savePos` + `RIGHT_MARGIN = 14`
- [x] ✅ 旧版 v1 贴边位置不再读取，首次展示为新默认布局 — `POS_KEY = 'knowme.fab.pos.v2'`，与 design 迁移计划一致

## 核心路径 — 主题与交互反馈

- [x] ✅ 浅色主题图标 `#26384d`，与暖灰工作台有足够对比 — 默认 `#km-fab-btn { color: #26384d }`
- [x] ✅ 深色主题图标 `#f4efe7`，背景仍透明 — `@media (prefers-color-scheme: dark)` 块
- [x] ✅ 悬停：轻微上移 + 缩放 + 图标投影，无常驻容器阴影 — `:hover` transform + `.km-fab-glyph` drop-shadow
- [x] ✅ 键盘焦点：`focus-visible` 2px 轮廓可感知 — `outline: 2px solid rgba(42, 78, 139, .42)`
- [x] ✅ 处理中：仅在 composer/send  busy 时显示珊瑚光环 — `.processing` + `syncProcessingState` + `km-fab-halo`
- [x] 🔜 深色主题下 hover/focus/processing 真机目测 — CSS 已定义；**无深色截图**，移交 QA

## 核心路径 — 展开与面板（不退化）

- [x] ✅ 点击（非拖动）打开快捷面板，从图标左侧弹出 — `toggle` + `placePanel` + `#km-fab-panel { right: 0; bottom: 54px }`
- [x] ✅ 面板内容未改：KnowMe 助理头、继续工作卡、加入待办 / 日志中心 / 日志目录 — HTML 结构与原 IA 一致
- [x] ✅ Esc / 点外部 / 选菜单项后面板关闭 — 既有事件监听保留
- [x] ✅ 可恢复 Session 徽标、`has-resume` 提示、拖动与点击区分（4px 阈值）— 脚本逻辑未删减
- [x] ⚡ Electron 启动无本次变更相关错误 — `dev-self-test.md` 记录 PASS

## 体验标准（C 端长期使用）

- [x] ✅ 低打扰：常驻视觉重量显著低于旧版深色药丸 + 厚阴影 — 符合 proposal Why
- [x] ✅ 随时可达：36px 热区 + 纵向可调 + 位置持久化 — 满足高频用户场景
- [x] ✅ 无新增依赖、无 IPC 变更、无额外图片解码 — design Non-Goals 遵守
- [x] ✅ 减少运动偏好：`prefers-reduced-motion` 关闭 presence/processing 动画 — 无障碍保留

## 验收依据

- 开发自测：`evidence/dev-self-test.md`（lint / test / 定向 workspace-agent / Electron / 静态 UI 冒烟）
- 实现：`src/workspace.html` L3996–4558（CSS + initKnowMeFab）
- 规格：`openspec/changes/refine-assistant-fab/specs/workspace/spec.md` 三场景
- 硬门禁：885/885 test、lint PASS（用户与 dev-self-test 双重确认）

## 验收结论

- [x] **通过** / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-04
- 备注：
  - **制作人放行范围**：低打扰视觉、右下安全边距、浅/深主题契约、hover/focus/processing 逻辑、点击展开与面板 IA 不退化、纵向拖动与 v2 持久化 — 均达标，可放行 **测试 QA**。
  - **证据缺口（advisory）**：`dev-self-test.md` 引用的 `evidence/screenshots/fab-closed.png`、`fab-open.png` **尚未入库**；QA 首跑须补浅色收起/展开截图。
  - **QA 补证**：深色主题实机、复杂背景对比、v1→v2 升级后首启位置、拖动后重启恢复、Agent 运行中 processing 光环。
