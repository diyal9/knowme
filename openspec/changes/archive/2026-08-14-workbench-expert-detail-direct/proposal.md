## Why

工作台点击快捷专家时会先打开整页「能力 Hub」，再叠一层专家详情弹窗，打断工作台上下文；同时工作台详情底栏仍展示「已在工作台 / 复制为自建」等管理动作，与「在工作台开工」心智不符。需要：工作台直接出二级详情弹窗，且只保留「开始对话」；能力界面保持现有管理向体验。

### 目标用户

- 在工作台用快捷专家卡快速开工的知识工作者
- 仍需在能力 Hub 安装、绑定、复制与调优专家的进阶用户

### 验收标准

- 工作台快捷专家卡直接打开专家二级详情弹窗，工作台主界面仍可见（不切换到能力 Hub 整页）
- 工作台打开的详情底栏仅有「开始对话」（或未启用/未安装时的对应开工文案）
- 「+ 新建任务」仍打开任务编排弹窗
- 能力界面点击专家：仍先进入能力 Hub，详情底栏保持管理向动作（添加到工作台 / 复制 / 调优等），无「开始对话」

### 非目标（Non-goals）

- 不新建第二套专家详情 DOM/数据模型
- 不改任务创建 / 专家 Session 后端协议
- 不重做能力 Hub 信息架构

## What Changes

- 工作台快捷专家卡以 `presentation=detail` + `surface=workbench` 打开轻量专家详情叠层
- 宿主以透明覆盖层承载 Hub iframe，不再走能力 Hub 中心整页
- Hub 在 detail 呈现下隐藏目录壳层，仅展示二级详情弹窗；关闭详情即关闭叠层
- 工作台 surface 底栏仅渲染开工 CTA；能力 surface 保持现状

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `agent-workbench`: 快捷专家卡直接打开详情叠层，不进入能力 Hub 整页
- `capability-hub`: 支持 detail 呈现；工作台 surface 底栏仅开工动作

## Impact

- `src/workbench.js` — 快捷卡入口参数
- `src/workspace.js` — detail 叠层打开/关闭与消息源识别
- `src/capability-hub.js` / `.html` / `.css` — presentation 状态、壳层隐藏、底栏裁剪
- `tests/capability-hub.test.js`、`tests/expert-task-chat-workbench.test.js`
