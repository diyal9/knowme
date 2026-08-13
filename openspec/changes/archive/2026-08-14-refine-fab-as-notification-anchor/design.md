## Context

悬浮铃铛实现集中在渲染进程 `src/workspace.html` 的 `#km-fab-root`（CSS + 内联脚本），不经主进程 IPC 承载 Session 恢复 UI。当前默认 `right: 14px; bottom: 18px`，拖动时 `RIGHT_MARGIN = 14`；面板内 `#km-fab-resume` 通过 `agentSessionList` 拉取可恢复 Session 并驱动红点。见 proposal.md — Why。

## Goals / Non-Goals

**Goals:**

- 默认贴角更紧（约 `6–8px`），拖动后右侧边距与默认一致。
- 删除 FAB 内 Session 恢复建议整条链路（DOM / 渲染 / dismiss / badge 联动）。
- 面板文案对齐「通知」心智；保留日志快捷与拖动。

**Non-Goals:**

- 不引入新的通知数据源或主进程订阅。
- 不删除工作台主路径的 `resumeSession`（专家任务恢复等）；只保证 **FAB 脚本零引用**。

## Decisions

1. **贴角边距用 `6px`**  
   - 比 `14/18` 明显更贴角，仍留出点击与红点描边余量。  
   - 备选 `0`：易贴边裁切、与窗口圆角冲突 → 否。

2. **FAB 专注通知 + 快捷处理**  
   - 删除 Session 恢复卡与全部 `resumeSession` / `agentSessionList` 联动。  
   - 面板只保留通知向标题与日志等快捷入口。

3. **红点默认隐藏，不再绑 Session**  
   - 避免「无通知却有红点」。  
   - 真实通知系统后续再接同一 badge 节点。

4. **进程边界**  
   - 仅改渲染层；不新增 IPC；不增加启动订阅，无额外内存占用。

## Risks / Trade-offs

- [Risk] 旧用户习惯从铃铛恢复 Session → Mitigation：产品明确通知入口不含该能力；恢复改走工作台主路径。  
- [Risk] 旧 localStorage 位置记录仍用较大视觉空隙感 → Mitigation：`applyTop` 每次写回新 `RIGHT_MARGIN`，默认 CSS 同步收紧。

## Migration Plan

- 纯前端变更；无数据迁移。  
- 可选清理 `knowme.fab.resume.dismissed.v1` 读写（代码删除即可，残留 key 无害）。  
- 回滚：恢复 resume 块与旧边距。
