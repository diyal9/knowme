## Context

见 proposal.md。渲染进程 `workbench.js` + `workspace.html` 维护顶栏 `#wbRunningToggle` / `#wbRunningPopover`；列表数据来自 console projection，与任务首页 / 管线服务记录同源不同壳。无主进程 / IPC 变更。

## Goals / Non-Goals

**Goals:**
- 干净删除顶栏入口与死代码路径，避免留下 `hidden` 残留控件。
- 恢复路径收敛到任务面与管线服务面，不引入新的全局 chrome。

**Non-Goals:**
- 不改 console projection 数据模型。
- 不在货架网格加「进行中」条。

## Decisions

1. **整段删除 DOM，而不是长期 `hidden`**  
   理由：控件已无产品职责，留壳会让契约与视觉债继续积累。  
   备选：仅 `hidden` + 关掉 `syncRunningToggleVisibility` → 拒绝，半死状态更难维护。

2. **删除 `renderRunList` 对顶栏的绑定；若函数仅服务 popover 则一并删除**  
   理由：popover 是唯一消费者时保留函数等于死代码。若其它路径仍调用，改为空操作或仅保留内部状态同步所需的最小逻辑。  
   备选：保留 `renderRunList` 只更新 count → 拒绝，无 UI 消费者。

3. **引导文案去掉「货架顶部进行中」承诺**  
   理由：与真实恢复路径一致，避免用户找不存在的按钮。

## Risks / Trade-offs

- [Risk] 工作流 Tab 上少了「一眼看到有 N 个运行」的徽标 → Mitigation：任务首页与管线「进行」筛选已覆盖；接受货架顶栏更克制。
- [Risk] 历史 smoke/契约仍断言 `#wbRunningToggle` → Mitigation：同步改 `tests/workbench-templates.test.js` 与本 change 证据。

## Migration Plan

无需数据迁移。回滚即恢复 HTML/JS 控件与测试断言。
