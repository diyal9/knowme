## ADDED Requirements

### Requirement: 审阅面扁平层次

Daemon 审阅右栏 MUST 使用单层浅色表面，MUST NOT 再呈现「外层米色壳 + 内层白卡」的装饰性嵌套。底栏操作区背景 MUST 与内容面同属浅色体系，MUST NOT 使用明显深色条带。

#### Scenario: 步骤内容无卡套卡

- **WHEN** 用户打开管线审阅「步骤」Tab
- **THEN** 步骤条目以时间线/列表呈现，且不套在第二层白色装饰卡片内

#### Scenario: 底栏非深色

- **WHEN** 审阅面显示底栏操作按钮
- **THEN** 底栏背景为浅色表面（与内容区同色阶），仅以分割线区分

### Requirement: 底栏图标两字按钮

Daemon 审阅底栏主操作 MUST 使用图标 + 恰好两个汉字的文案（如「刷新」「重跑」「返回」）。完整语义 MAY 放在 `title`/`aria-label`。

#### Scenario: 失败态底栏

- **WHEN** 管线运行失败且显示底栏
- **THEN** 可见带图标的「刷新」「重跑」「返回」按钮

### Requirement: 步骤进度可读

「步骤」Tab MUST 展示编排进度：完成比例与当前节点（有真实节点时）。降级且无节点时 MUST 使用紧凑说明，MUST NOT 用嵌套错误卡冒充步骤。

#### Scenario: 有节点进度

- **WHEN** 任务投影含多个编排节点
- **THEN** 步骤区显示 n/total（或等价进度）且当前节点视觉可辨

#### Scenario: 降级空步骤

- **WHEN** 流程详情不可用且无真实节点
- **THEN** 显示紧凑降级说明与日志入口，不渲染「流程详情暂不可用」装饰步骤卡

### Requirement: 变更区代码工作区入口

「变更」Tab MUST 提供「代码工作区」入口；点击 MUST 打开任务代码工作区浏览器（非 stub toast）。

#### Scenario: 打开工作区

- **WHEN** 用户在变更 Tab 点击「代码工作区」且存在任务 slug
- **THEN** 打开左右分栏文件树 + 内容预览界面
