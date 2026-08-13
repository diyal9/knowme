## Purpose

约束能力 Hub 在主目录已展示后，辅助数据补齐与 iframe 复用打开时不得再次整格重绘目录卡片，避免用户感知的双重刷新。

## ADDED Requirements

### Requirement: Auxiliary hub data must not repaint the catalog grid

当主目录已完成首屏渲染后，编辑器装配目录、composition 索引与工作台绑定等辅助数据补齐 MUST NOT 触发精选区或目录网格的整格重绘；若辅助数据仅影响详情抽屉（例如「添加到工作台」按钮态），Hub MUST 仅更新抽屉。

#### Scenario: Auxiliaries finish after primary catalog painted

- **WHEN** 当前 Tab 主目录已展示卡片，随后辅助数据加载完成
- **THEN** 精选区与目录网格不因辅助完成而重新写入整格 HTML
- **AND** 若详情抽屉已打开且依赖工作台绑定，抽屉操作态可更新

### Requirement: Soft resume must not double-refresh the catalog

宿主复用已加载的能力 Hub 并发送 resume 同步时，在当前 Tab 未变化的情况下，Hub MUST NOT 连续执行「绑定刷新重绘网格」与「soft 拉目录再整页渲染」两次目录刷新；MUST 将同步限制为 Tab/深链选择更新，以及对工作台绑定的轻量刷新。

#### Scenario: User reopens Capabilities on the same tab

- **WHEN** 用户关闭后再打开能力 Hub，且目标 Tab 与 iframe 内当前 Tab 相同
- **THEN** Hub 不同时触发目录网格的两次整格重绘
- **AND** Hub 不因 resume 而强制 soft 重拉主目录
- **AND** 工作台绑定状态仍可在后台刷新并反映到已打开的详情抽屉
