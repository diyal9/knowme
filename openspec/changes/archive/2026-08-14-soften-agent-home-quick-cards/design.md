## Context

See proposal.md — Why。当前 pack 空状态由 `partitionPackHomeCards` 把 `workflow-intake` 抽成 `agent-workflow-entry`，四张推荐卡使用偏实心的 `.agent-empty-act` 样式。

## Goals / Non-Goals

**Goals:**

- 用 pack 配置隐藏首屏工作流入口（方案 A）
- 仅弱化 `.agent-empty-home` 网格内卡片，避免波及专家空态等同名按钮

**Non-Goals:**

- 删除渲染路径 `agent-workflow-entry`（其它 pack 仍可使用）
- 改主进程 / IPC

## Decisions

1. **隐藏方式：`showInEmptyState: false` on `workflow-intake`**  
   - 相对删渲染或改 partition：改动最小、可逆、不影响 `getPackWorkflow` / 场景元数据。  
   - 备选 B（全局停渲染）否决：过度耦合其它 pack。

2. **弱化范围：仅 `.agent-empty-home .agent-empty-act`**  
   - 保留默认 `.agent-empty-act` 供专家/管家等入口使用。  
   - 轻档：透明底、极淡边框、无阴影、图标块缩小且去实心底、标题 500 + 中灰、描述更淡、`min-height` 约 50px；hover 浅底、不抬升。

3. **Electron 边界**  
   - 纯渲染层 CSS + pack JSON；无 IPC、无主进程变更。

## Risks / Trade-offs

- [Risk] 用户仍想从首页进「需求梳理」→ Mitigation：快捷命令面板 / 工作台仍可发现；后续可再加次要文字链  
- [Risk] 弱化过度导致「不可点」感 → Mitigation：保留边框与 hover；自测时核对焦点环

## Migration Plan

- 配置与 CSS 即生效；已安装 pack 若从 bundled 重载 scenes 即可  
- 回滚：恢复 `showInEmptyState: true` 与原 CSS
