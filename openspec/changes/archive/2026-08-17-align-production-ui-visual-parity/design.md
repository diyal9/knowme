## Context

See proposal.md — Why。当前渲染层已是 React feature 包 + 基线 CSS 类名迁入 `src/renderer/styles/**`；`restore-game-studio-ui-parity` 等 change 把主干面标成「有/薄」，但 **Electron 真机像素未签字**，且壳层炭黑与工作台绿双 accent 曾明确「需产品拍板」。对照 oracle：`f6ad048` 截图在 `openspec/changes/restore-game-studio-ui-parity/evidence/screenshots/baseline/`。

Electron 边界：本 Story **仅改渲染层 CSS / 少量 DOM 结构与 class**；主进程与 IPC 不改（除非发现纯展示绑定 bug）。禁止 `ipcRenderer` 进 renderer。

## Goals / Non-Goals

**Goals:**

- 文档化并强制 token 分层，消除同屏主 CTA 混用
- 高曝光面相对基线的布局/空态/密度对齐到制作人可签字
- 生产级交互：焦点环、悬停、键盘、过渡、滚动、加载与空态反馈一致
- 可复跑截图证据 + 签字清单

**Non-Goals:**

- 不引入新设计系统组件库或换图标集
- 不改 Agent 编排、会话协议、能力 Hub 业务逻辑
- 不批量清扫全库历史 hex（只清签字面与主 CTA 路径）

## Decisions

### 1. 双 accent 语义保留，禁止误用

**Choice:** 壳层 / Rail / 设置主操作继续用 `--accent`（炭黑 `#3d3a36`）；工作台 / 货架 / 管线 / Studio 主 CTA 用 `--wb-accent`（墨绿）。在 `tokens.css` + `workspace-chrome.css` 顶部注释语义表；主按钮选择器只引用本层 token。

**Alternative:** 全站统一为绿或统一为炭黑 — 否决：基线本身就是双语义；统一会制造更大「变样感」。

### 2. CSS-first，少动 React 树

**Choice:** 优先调 class / token / 去掉多余 wrapper；仅当基线 DOM 结构缺失（如助理快捷卡 2×2）才改 JSX。

**Alternative:** 重写 UI 组件 — 否决：漂移更大、回归面更大。

### 3. 高曝光签字面优先

**Choice:** Wave 顺序：Token 守卫 → 助理空态 → 工作台专家协作首页 → 工作流货架/管线 CTA → 专家库/设置控件 → 交互 polish（focus/键盘/滚动）→ 截图与签字。

**Alternative:** 全站扫一遍 — 否决：无法在一个 Story 内验收。

### 4. 证据与守卫

**Choice:** 复用/扩展 `scripts/capture-restore-ui-parity.js`（或同级脚本）输出到本 change `evidence/screenshots/`；可选轻量 lint：禁止 `.wb-*-btn.primary` 硬编码 `#3d3a36` / 壳层 primary 硬编码 `#2f6f5e`。

**Alternative:** 仅人工目视 — 否决：无法回归。

### 5. 性能

不新增运行时动画库；过渡用 CSS（≤200ms 常规、≤320ms 面板）。不增加首屏 JS bundle 体积为目标之一。

## Risks / Trade-offs

- [Risk] React 额外 wrapper 导致「改 CSS 仍对不齐」→ **Mitigation:** 对照基线 DOM；删掉无语义布局层
- [Risk] 双 accent 被误解为 bug → **Mitigation:** acceptance 写明语义；测试反模式「同屏两个不同主色按钮」仅针对错误混用
- [Risk] 截图用 Chromium preview ≠ Electron 真机 → **Mitigation:** 制作人验收以 `npm start` 真机为准；preview 作开发辅助
- [Risk] 与未归档的 `restore-*-parity` 任务重叠 → **Mitigation:** 本 Story 只吃「视觉/交互」；功能空洞仍归原 change，签字清单交叉引用

## Migration Plan

1. 落地 token 注释 + 主 CTA 收口
2. 按 Wave 改高曝光面，每 Wave 更新截图
3. 制作人真机签字 → 测试按 qa-plan
4. Rollback：还原 `src/renderer/**` CSS/JSX 相关 commit；无数据迁移

## Open Questions

无阻塞项。次要面（日志窗细节、记忆窗）若签字后仍有感，另开 follow-up。
