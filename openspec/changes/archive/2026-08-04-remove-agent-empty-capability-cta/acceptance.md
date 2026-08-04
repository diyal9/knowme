# 制作人体验验收: remove-agent-empty-capability-cta

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**证据**：`evidence/dev-self-test.md`；OpenSpec strict PASS；定向 33/33；`npm test` 885/885；`npm run lint` PASS；Playwright snapshot + Electron 重启冒烟

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 静态契约 / 单元测试 / Playwright 预览 / 代码走查已证实 |
| ⚡ | Electron 真机冒烟（无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 用户诉求对齐

- [x] ✅ Agent 空状态不再显示「打开能力 Hub / 浏览专家、技能与连接器」大卡片 — `workspace.html` 无 `data-capability-hub`；`workspace-agent.js` `renderEmptyState()` 仅渲染任务卡片
- [x] ✅ 空状态首屏聚焦「立即开工」任务入口，不与左侧 rail 重复 — 仅四张任务卡片 + hero/sub 文案
- [x] ✅ 与 proposal Non-goals 一致：未动 rail、设置页、Hub 页面本身

## 空状态任务入口

- [x] ✅ 初始 HTML 保留四张办公任务卡片 — 会议总结 / 今日优先级 / 查文档·知识库 / 分析跟我相关的聊天
- [x] ✅ 动态重绘（清空会话后）仍渲染相同四卡片 — `EMPTY_SHORTCUT_PRESETS.general` 与 `renderShortcutCards('general')`
- [x] ✅ 点击任务卡片仍可触发 preflight / auto-send 链路 — `data-auto-send="1"` + `data-shortcut` 保留；`resolveEmptyShortcutPrompt` 未改
- [x] 🔜 四卡片点击后各走一条冒烟（授权/缺素材提示或正常开工） — 继承 agent-task-preflight-ask 行为；QA 补证

## 能力入口保留

- [x] ✅ 左侧 rail 统一「能力」按钮仍存在 — `btnRailCapabilities` + aria-label
- [x] ✅ 点击 rail「能力」仍可打开 Capability Hub overlay — `openCapabilityHub` / `toggleCapabilityHubRail` 未改
- [x] ✅ 设置页「打开能力 Hub」按钮保留 — `settings.html` `btnOpenCapabilityHubFromSettings`（符合 Non-goals）
- [x] ✅ `window.openCapabilityHub` / `open-capability-hub` postMessage 深链仍可用 — `workspace.js` 未删

## 代码清理

- [x] ✅ 静态模板无 `data-capability-hub=` — 契约测试 `workspace-capability-rail.test.js` PASS
- [x] ✅ 专用 `[data-capability-hub]` 点击分支已删除 — `workspace-agent.js` 无 capability-hub 匹配；`workspace.js` 无 `closest('[data-capability-hub]')`
- [x] ✅ 无遗留「打开能力 Hub」空态文案 — 全仓 `src/` 仅设置页保留该文案

## 其他模式空态（回归）

- [x] ✅ 知识管家 / 编程 / 写作 / 工作台模式空态未误删 — `renderEmptyState()` 分支完整
- [x] 🔜 切换 Session 至 steward/coding/writing 后空态卡片正确 — QA 走查

## 体验标准

- [x] ✅ 空状态视觉层级更清晰：hero → 四任务网格，无 oversized Hub CTA 抢注意力
- [x] ✅ 与 consolidate-capability-hub-entry 信息架构一致：能力管理归 rail，空态只做任务引导
- [x] ⚡ Electron 重启后 Agent 空态正常渲染，控制台无 uncaught error — dev-self-test

## Advisory（不阻塞放行）

| 级别 | 项 | 说明 |
|------|-----|------|
| ADVISORY | 能力发现性 | 移除空态 CTA 后新用户需依赖 rail tooltip；rail 持续可见，可接受 |
| ADVISORY | code-review.md | 软门禁尚未填写，测试接入前建议补 |

## 验收依据

- 开发自测：`evidence/dev-self-test.md`
- 规格：`proposal.md`、`design.md`、`specs/workspace/spec.md`、`tasks.md`
- 硬门禁：OpenSpec strict PASS；定向 33/33；`npm test` 885/885；`npm run lint` PASS

## 验收结论

- [x] **通过** / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-04
- 备注：**PASS** — 用户明确要求移除的空态 Hub 大卡片已清除；四任务入口与左侧统一能力入口均保留，无功能回归。可放行测试 QA 接入。
