## 架构

### 模块边界

| 模块 | 职责 | 留在 workbench.js |
|------|------|-------------------|
| `workbench-task-composer-schedule.js` | DOM 读写 schedule、reset/sync、tooltip 文案常量 | composer 壳层 HTML、事件绑定、IPC |
| `workbench-task-scheduler.js`（已有） | 主进程 tick、nextRunAt 计算 | — |

浏览器侧 lib 采用与 `workbench-daemon-surface.js` 相同的 UMD：`window.WorkbenchTaskComposerSchedule` + `module.exports`。

### 产品叙事（冻结对齐 deferral）

| 能力 | 用户可见真相 |
|------|----------------|
| 专家任务定时 | 可写计划；到期**新建子任务并 beginExpertTask**；须 App 在线；**不**代发消息/不无人值守 |
| 侧栏自动化 | Workflow Job 模型；未绑定可执行管线 → `scheduler_unavailable`，计划为草稿 |
| 合并规划 | 后续与自动化统一入口（本 change 不实现） |

### workbench 拆分策略

仅抽 **schedule/composer 纯函数 + DOM 辅助**，不碰 daemon review / task room 状态机。

## 风险

- 静态契约测试若断言 `function readTaskComposerSchedule` 于 workbench 内定义 → 保留薄包装函数转发至 lib。
