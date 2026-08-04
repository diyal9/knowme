## Context

Hub 通过 iframe 嵌入工作区的全屏 drawer。工作区宿主已持有 drawer 顶部栏、Hub 当前 Tab 状态以及与 iframe 的 `postMessage` 同步，因此单层菜单必须由宿主渲染；内嵌页面只负责内容。

## Goals / Non-Goals

**Goals:**
- 让工作区宿主中的 Hub 顶部栏复刻工作台 `.wb-head` 的结构与视觉层级。
- 让 Hub 类型页签与工作台 `.wb-tabs-group` / `.wb-tab` 呈现一致。
- 保留 Hub 现有语义、事件和响应式布局。

**Non-Goals:**
- 不抽取跨页面共享 CSS 模块，避免为一次小型视觉对齐扩大加载边界。
- 不改变工作台现有页签或能力 Catalog 行为。

## Decisions

### 在 Hub 样式中镜像工作台页签令牌

直接对齐尺寸、颜色、圆角、边框和阴影。相比在两个独立页面间引入共享 stylesheet，此方案不增加请求、启动依赖或运行时耦合；未来建立完整设计令牌系统时再统一抽取。

### 由工作区宿主渲染唯一菜单栏

在通用 drawer head 内增加仅对 `drawer-capability-hub` 可见的能力品牌与类型页签，复用宿主已有 `capabilityHubTab` 状态。父页签切换通过现有深链重新定位 iframe，子页面继续用既有 `capability-hub-tab` 消息反向同步。

### 内嵌页面隐藏本地菜单栏

Hub 根据 `embedded=1` 为 body 添加状态类并隐藏自身 `.hub-nav`；独立预览时仍保留本地菜单栏，便于开发与降级访问。

### 删除内容区重复介绍

移除静态 `.hub-intro` DOM。动态元信息更新继续使用空值保护，目录标题与结果数量仍在 Catalog 区展示，避免丢失筛选反馈。

## Risks / Trade-offs

- [两处样式未来可能再次漂移] → 用静态契约测试锁定关键视觉值，并在后续设计令牌改造时统一抽取。
- [长标签 MCP 连接器比工作台标签更宽] → 保留内容驱动宽度，不强制等宽。
- [父页签切换会重载 iframe] → 保留现有深链机制以降低状态同步风险；Catalog 体量小，后续需要时再改为消息内切换。

## Migration Plan

发布 CSS 与测试更新即可，无数据迁移。回滚时恢复 Hub 页签旧样式，不影响用户数据或 IPC。
