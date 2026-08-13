## Context

能力 Hub 以 iframe 嵌在工作台 `drawerBody` 中；渲染进程经 preload bridge 调主进程 IPC 拉目录。当前关闭即销毁 iframe，再次打开冷启动；`loadCatalog` 在主目录之外还串行等待编辑器 catalog / composition / 工作台绑定，skeleton 贯穿全程。动机见 proposal.md Why。

边界：改动仅在工作台宿主渲染进程与 Hub 渲染进程；不改 IPC 协议形状与主进程扫描策略。

## Goals / Non-Goals

**Goals:**

- 二次打开复用同一 iframe，跳过 HTML/JS 冷启动。
- 主目录到达即可交互；辅助数据后台补齐。
- 其它中心面占用 `drawerBody` 时不误杀 park 的 Hub。

**Non-Goals:**

- 不预加载 Hub（应用启动即挂 iframe）。
- 不改主进程缓存层。
- 不引入虚拟列表。

## Decisions

### 1. 宿主 park 容器复用 iframe

在 `workspace.html` / `workspace.js` 使用隐藏 park 节点（或等价 document 外挂载点）。`closeDrawer` 在 `drawerKind === 'capability-hub'` 时把 `.capability-hub-frame` 移入 park，而不是依赖后续 `innerHTML` 清空销毁。`openCapabilityHub` 优先把 park 中的 frame 移回 `drawerBody`；仅在无可用 frame 时创建新 iframe。

打开知识库/设置等会写 `drawerBody` 的路径前，先调用同一 park 逻辑，避免 `innerHTML` 丢掉 Hub。

替代方案：关闭时只 `display:none` 整个 drawer 且不清 body——会与其它中心面抢占同一 drawer 冲突，故采用显式 park。

### 2. 渐进 `loadCatalog`

Hub 内：

1. `loading=true` → skeleton  
2. await 当前 Tab 的 `capability.list` / `capabilityList`  
3. 写入 `state.items`，`loading=false`，`render()`（首屏可交互）  
4. 并行/后台跑 `loadExpertEditorCatalog`、`loadCompositionIndex`、`workbenchModeList`，完成后局部更新（不必再 skeleton）

Tab 切换仍走完整主目录请求；辅助数据可复用内存中的 skills/connectors（可选短缓存，失败则按现有空数组降级）。

### 3. 复用打开时的轻量刷新

通过 `postMessage`（如 `capability-hub-resume`）通知已挂载 Hub：同步 tab/expertId/surface，并后台刷新工作台绑定（及可选主目录 soft refresh），**不**强制整页 reload。深链选中仍走现有 `capability-hub-select-expert`。

### 4. 内存与生命周期

会话内保留最多一个 park 的 Hub iframe。不在应用退出前主动销毁（随窗口生命周期回收）。若 park frame 的 `contentWindow` 不可用则丢弃并重建。

## Risks / Trade-offs

- [Risk] park 的 Hub 状态过期（刚在工作台添加专家）→ [Mitigation] resume 时后台刷新 bindings；安装/卸载后现有成功路径已 `loadCatalog`。
- [Risk] 其它面板 `innerHTML` 忘记 park → [Mitigation] 抽 `parkCapabilityHubFrame()`，在写 `drawerBody` 的中心面入口统一调用；测试断言存在该调用。
- [Risk] 辅助数据未到时打开专家编辑器 catalog 为空 → [Mitigation] 编辑器打开时若 catalog 空再补拉（现有 load 函数可复用）。
- [Trade-off] 多占一个休眠 iframe 的内存，换二次打开速度。

## Migration Plan

无需数据迁移。发布后自动生效；回滚仅还原 `workspace.js` / `capability-hub.js`（及测试）。
