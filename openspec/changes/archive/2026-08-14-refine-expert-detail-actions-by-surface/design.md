## Context

工作台快捷专家卡当前调用 `openTaskComposer`；Capability Hub 详情已有 `startExpert` / `addExpert` / `copyExpert` / `tuneExpert`，但未按入口分面。宿主通过 iframe 嵌入 `capability-hub.html`，见 proposal.md Why。

## Goals / Non-Goals

**Goals:**
- 用 query + postMessage 深链打开指定专家详情并携带 `surface`
- 渲染层按 surface 组装底栏，修复 foot 裁切
- 工作台快捷卡改为深链；新建任务保持 composer

**Non-Goals:**
- 不新建第二套专家详情 UI
- 不改 IPC 安装/绑定协议

## Decisions

1. **复用 Hub 详情弹层** — 工作台经 `openCapabilityHub('experts', { expertId, surface: 'workbench' })` 打开，避免复制 drawer DOM。备选：工作台内嵌独立 modal（放弃，维护成本高）。

2. **surface 状态在 Hub 渲染进程** — `state.surface` 来自 URL 或 `capability-hub-select-expert` message；默认 `capability`。备选：仅靠 URL（放弃，已打开 Hub 时需 postMessage）。

3. **能力面移除开工 CTA** — 「开始对话」仅 `surface=workbench`；能力面主 CTA 为绑定工作台。开工入口保留在工作台/助理。

4. **底栏布局** — `secondary-dialog__foot` 保持 `flex-wrap`；缩小 `.hub-drawer-foot .hub-btn` min-width，确保三按钮同行或换行后脚部增高不被 `overflow:hidden` 裁切。

## Risks / Trade-offs

- [Risk] 打开 Hub 会盖住工作台整页 → 接受：详情关闭后仍可回工作台；后续可再做轻量 modal。
- [Risk] 缓存旧 JS 导致只见单按钮 → bump `capability-hub.js/css` query 版本。

## Migration Plan

纯前端行为变更；无数据迁移。回滚：恢复快捷卡 `openTaskComposer` 与统一底栏即可。
