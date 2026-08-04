## Context

Capability Hub 已是单一 iframe 页面，并已有三类 Tab 与 `?tab=` 深链。重复主要发生在工作台 rail：三个入口分别修改同一个 iframe 的初始 Tab，造成导航冗余。变更只涉及渲染进程 DOM、样式语义和前端状态，不触及主进程、preload 或 IPC。

## Goals / Non-Goals

**Goals:**

- rail 只保留一个能力入口
- Hub 默认从专家开始，并在页内切换专家、技能、MCP 连接器
- 保留已有 `openCapabilityHub(tab)` 深链兼容性
- 保持启动性能和内存占用不变

**Non-Goals:**

- 不修改 capability catalog、安装状态机或 connector runtime
- 不新增页面、窗口、IPC 或依赖
- 不重排卡片和详情抽屉信息架构

## Decisions

### 1. 复用现有 Capability Hub，不创建容器页面

现有 `capability-hub.html` 已同时承载三类数据，继续将其作为唯一页面。备选方案是新增聚合页再嵌套三页，但会增加 iframe、加载和状态同步成本。

### 2. rail 使用一个组合能力图标

删除三个独立按钮，新增 `btnRailCapabilities`。按钮激活态只反映 Hub 是否打开，不再随页内 Tab 变化。这样 rail 表达“模块”，Tab 表达“模块内分类”。

### 3. 默认 Tab 改为专家，深链继续显式覆盖

单入口点击调用 `openCapabilityHub('experts')`；Agent 空状态等既有入口仍可传 `skills` 或 `connectors`。Hub 内切换继续通过 state 更新内容，并通知父页保存当前 Tab。

### 4. Tab 文案明确 MCP 属性

第三个 Tab 显示“MCP 连接器”，内部路由值仍为 `connectors`，避免破坏 catalog kind、URL 和 IPC 契约。

## Risks / Trade-offs

- [用户习惯从 rail 直达技能或连接器] → 保留页面内一键 Tab 与既有深链入口
- [单入口再次点击的关闭语义不清] → 沿用现有 rail 按钮 toggle 行为
- [Tab 文案变长导致窄窗口拥挤] → 保持响应式布局，并允许 header 在窄宽度下收敛间距
- [旧测试锁定三个按钮] → 更新为单入口与页内 Tab 契约测试

## Migration Plan

1. 发布时直接替换 rail DOM 与事件绑定，无用户数据迁移。
2. `?tab=experts|skills|connectors` 继续兼容。
3. 回滚时恢复三个按钮和各自事件绑定即可。
