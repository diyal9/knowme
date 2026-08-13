## Why

Daemon Tab 当前把远程 workflow 目录与只读专家阵容当作主界面，用户难以快速选对交付路径，也难以从「管线记录」理解进度与下一步。需要把 Daemon 收成「常用交付路径 + 材料提示 + 管线记录 + 审阅优先」，并与顶栏「任务」（本机专家）划清边界。

## What Changes

- Daemon 左栏改为策展后的**常用路径**（primary ≤4）+「更多路径」（advanced / 其余）。
- 中栏主内容改为：路径结果说明、短阶段条、**材料体检（软门禁）**、开工；专家阵容降为可展开的只读「团队构成」。
- 右栏文案与呈现改为**管线记录**（intent 优先、状态与下一动作）；提供「全部 / 需要你 / 进行中 / 已完成」筛选。
- Daemon 运行详情默认强调进度 / 需要你 / 产物；团队构成与运行日志默认折叠。
- **非目标**：智能意图匹配、独立 Prep 流水线产品化、推翻三栏壳、与「任务」Tab 合并。

### 目标用户

- 主要：要用 Daemon 跑固定交付管线的工程/制作同学。
- 次要：需要回看远程 run 产物与门禁的协作方。

### 验收标准

- 进入 Daemon，首屏常见路径 ≤4，不默认展示专家墙。
- 材料不齐时有软提醒，仍可开工；Daemon 离线或 locked 时硬禁用开工。
- 管线记录标题优先 intent；失败/等待有可行动下一动作文案。
- 运行页可展开查看团队构成与日志；默认不抢主视野。
- 与「任务」Tab 文案不混用「任务」指称 Daemon runs。

### 非目标（Non-goals）

- 不做意图自动匹配推荐。
- 不做「需求→合格文档 / 美术→ArtBundle」完整 Prep 工作流（留 P1）。
- 不重做非对称大布局或引入新前端框架。
- 不改 Daemon HTTP 协议与启动 IPC。

### 商业化与体验价值

Daemon 是远程算力/订阅的落点；降低「看不懂模式列表」的流失，让用户更快完成一次成功开工与回看产物，形成可复访的管线记录。

## Capabilities

### New Capabilities

- （无）行为落在既有工作台能力上。

### Modified Capabilities

- `agent-workbench`：Daemon Tab 由「模式目录 + 专家阵容墙 + 任务监控」改为「常用路径 + 材料体检 + 管线记录」；运行详情审阅优先。

## Impact

- `src/workbench.js`：`renderDaemonMode`、事件、运行页折叠逻辑。
- `src/lib/workbench-daemon-surface.js`（新增）：路径策展 / 材料体检 / 记录投影。
- `src/workspace.html`、`src/workbench-console.css`：文案与样式。
- `tests/workbench-daemon-surface.test.js`（新增）。
- OpenSpec：修订 `restructure-workbench-task-workflow-daemon` 中「专家阵容为主展示」的隐含验收，改为可访问的只读信息。
