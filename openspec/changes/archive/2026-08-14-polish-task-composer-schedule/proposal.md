## Why

「安排专家执行任务」弹窗里，任务知识库选项稀疏占位、下方留白过大；任务目标会误带上会话残留的 `pendingGoal`（例如管线侧「三元礼包」），让用户以为产品写死了默认文案。同时任务级定时能力已存在，但新建弹窗没有入口，用户无法在开工时一并设定时。

## What Changes

- 紧凑化「任务知识库」选项排版，减少无意义留白。
- 「+ 新建任务」打开弹窗时任务目标默认为空，不再回填 `pendingGoal`；仅在显式传入 `goal` 时预填。
- 在新建弹窗增加可选「定时任务」设置（每天 / 间隔 / 单次），创建时持久化到任务；「创建并开始」仍立即开工，定时供后续本机 tick 复跑。
- UI 提示：定时仅在 App 在线时触发。

## 目标用户

用工作台专家开任务、需要周期性复跑的桌面用户。

## 验收标准

- 知识库选项紧凑可读，弹窗不再大块空心。
- 从「+ 新建任务」打开时目标框为空（不受历史 pendingGoal 污染）。
- 可开启定时并选择频率；创建后任务带 `scheduleEnabled` 与计划标签/下次时间。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-Goals）

- 不改工作流自动化中心。
- 不做云端 cron / 关机后台触发。
- 不恢复最近任务区独立「定时任务」Hub 入口（本期入口在新建弹窗）。

## Capabilities

### New Capabilities

- `task-composer-schedule`: 新建专家任务弹窗的知识库排版、目标预填规则与定时设置。

### Modified Capabilities

- （无主规格 delta）

## Impact

- `src/workbench.js`、`src/workbench-layout.css`
- 复用 `workbench-task-scheduler` 字段归一化
- 相关单测 / OpenSpec 证据
