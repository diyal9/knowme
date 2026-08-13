## Context

能力 Hub 是渲染进程中的原生 HTML/JS 页面。目录数据通过 preload 暴露的 bridge 从主进程 IPC 获取，目录返回后由渲染进程生成卡片 HTML 并挂载内联图标。当前性能优化应只改变渲染调度，不改变 IPC 数据协议或目录数据源。

## Goals / Non-Goals

**Goals:**

- 将连续搜索输入合并为一次渲染，避免输入事件风暴。
- 让目录动画的等待时间与目录规模解耦，保证内容尽快可见。
- 保持现有状态更新顺序、键盘操作、筛选逻辑和 reduced-motion 兼容。

**Non-Goals:**

- 不在主进程增加缓存或改变能力目录扫描策略。
- 不引入虚拟列表、第三方调度库或新的 IPC 通道。
- 不重做当前信息架构和卡片视觉设计。

## Decisions

### 1. 在渲染层使用固定短防抖

搜索事件仅更新查询状态，使用约 120ms 的防抖调度 `renderPageMeta`、`renderFeatured` 和 `renderGrid`。选择渲染层防抖而不是主进程查询防抖，是因为当前过滤已经在渲染层完成，且不应改变 bridge/API 行为。120ms 足以合并连续输入，又不会让单次搜索产生明显等待。

替代方案：每次输入立即渲染，代码简单但条目多时会重复生成 DOM；节流会在用户持续输入期间展示中间结果，反馈不如短防抖稳定。

### 2. 使用 CSS `min()` 限制动画延迟

卡片保留现有轻量入场动画，但将基于索引的延迟限制为 `min(calc(var(--index, 0) * 45ms), 300ms)`；精选区同样限制。动画仍由 CSS 执行，不增加 JS 定时器和内存对象。

替代方案：完全删除动画会降低成本，但会损失当前页面的层次感；按固定延迟会让所有卡片同时出现，层次较弱。

### 3. 保持主进程和 IPC 边界不变

不修改 `capability-hub-service`、preload 或 bridge。优化只作用于渲染后的筛选和展示阶段，失败时不会影响目录加载、离线 fallback 或能力安装流程。

## Risks / Trade-offs

- [Risk] 120ms 防抖会让单字符搜索反馈略有延迟 → [Mitigation] 仅对搜索输入使用防抖，分类和安装筛选继续即时更新。
- [Risk] CSS `min()` 在极旧 Chromium 环境中不支持 → [Mitigation] Electron 31 使用现代 Chromium；reduced-motion 规则仍提供降级行为。
- [Risk] 取消组件或页面时仍可能有待执行的搜索回调 → [Mitigation] 回调只调用现有渲染函数，不触发 IPC 或持久化操作；事件监听生命周期与页面一致。

## Migration Plan

无需数据迁移。发布后渲染进程自动使用新的搜索调度和动画上限；如需回滚，仅回退 `capability-hub.js` 与 `capability-hub.css` 的对应改动。
