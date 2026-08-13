## Purpose

约束能力 Hub 打开与再次打开时的宿主保活与渐进首屏行为，缩短可交互等待，避免把冷启动与串行 IPC 误当成界面卡死。

## ADDED Requirements

### Requirement: Capability Hub iframe is reused across open/close

工作台宿主 MUST 在关闭能力 Hub 时保留其 iframe 实例以便再次打开时复用；MUST NOT 在每次打开时无条件销毁并重建该 iframe。当其它中心面需要占用同一内容区时，宿主 MUST 先安全转移（park）该 iframe，避免被覆盖销毁。

#### Scenario: User closes and reopens Capabilities

- **WHEN** 用户关闭已打开的能力 Hub，随后再次从侧栏或入口打开能力 Hub
- **THEN** 宿主复用既有能力 Hub iframe（若仍可用）
- **AND** 用户可立即看到上次已渲染的目录内容或同等已加载状态，而不是空白冷启动页强制等待整页重载

#### Scenario: User opens another center surface after Capabilities

- **WHEN** 能力 Hub 已打开或已 park，用户打开知识库或设置等会占用同一内容区的中心面
- **THEN** 能力 Hub iframe 被安全 park 且不被该中心面的内容写入销毁
- **AND** 用户之后再次打开能力 Hub 时仍可复用该 iframe（若仍可用）

### Requirement: Primary catalog paints before auxiliary hub data

能力 Hub MUST 在当前 Tab 主目录数据返回后结束加载骨架并渲染可浏览目录；编辑器装配目录、composition 索引与工作台绑定等辅助数据 MUST NOT 阻塞该首屏渲染。

#### Scenario: Primary catalog arrives while auxiliaries pending

- **WHEN** 当前 Tab 的能力主目录请求已成功返回，但辅助数据仍在加载
- **THEN** 页面结束骨架态并展示主目录卡片
- **AND** 用户可以搜索、筛选并打开详情
- **AND** 辅助数据稍后补齐时不重新进入整页骨架

#### Scenario: Soft resume on reused Hub

- **WHEN** 宿主复用已加载的能力 Hub iframe 再次展示
- **THEN** 宿主向 Hub 同步当前 Tab / 深链选择（如有）
- **AND** Hub MUST NOT 因同步而强制整页冷重载主文档
