## Why

管线服务 Tab 当前像说明书：顶栏与页内小标题重复「管线服务」、左栏多行说明、中栏阶段/材料/结果长文。用户要的是与 Daemon **操作**（连上、选路径、开工、跟运行），不是把目录说明再读一遍。

## What Changes

- 去掉与顶栏 Tab 重复的页头「管线服务」标题；连接状态改为顶栏操作条（在线/离线 + 重试）。
- 左栏交付路径改为名称主导的紧凑选择列表，摘要不默认刷屏。
- 中栏改为操作台：大号开工、精简阶段条、材料以一行就绪芯片呈现；说明与团队构成默认降级/折叠。
- 右栏管线记录保持主交互位（筛选 + 进入运行）。
- 视觉按设计密度收紧：少卡片堆叠、分隔线分层、触感微交互。

### 非目标

- 不改 Daemon HTTP 协议 / 启动 IPC。
- 不推翻三栏信息架构（路径 | 操作 | 运行）。
- 不引入 React/Framer 等新框架。

## Impact

- `src/workspace.html`、`src/workbench.js`（renderDaemonMode / openManagePanel）
- `src/workbench-console.css`、`src/workbench-shelf.css`
- 既有 `workbench-daemon-surface` 逻辑复用；测试补展示用例仅当有逻辑变更
