## Why

管线审阅「步骤」时间线目前是「圆点 + 通栏纯文字」，扫读像长名单而非可交互节点；用户无法点进某一节点看完整状态/产出路径，削弱「现在到哪 / 这一步是什么」的审阅价值。

## What Changes

- 步骤列表改为：**左侧时间线圆点对齐** + **右侧微展示节点卡**（轻量、左贴点、非整栏装饰壳）。
- 点击节点卡进入**节点详情**视图（状态、类型·执行者、产出路径、节点 ID 等），可返回列表。
- 审阅投影透传节点详情字段（产出短名/全路径、owner、type），避免列表有字段但详情拿不到。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：步骤 Tab 微卡片布局与节点详情钻取交互。

## 目标用户

- 在管线运行中快速定位「当前/某步节点」并核对产出的知识工作者与开发者。

## 验收标准

- 步骤列表左圆点对齐；右侧为微节点卡（非整栏通栏文字），当前节点可辨。
- 点击任一节点可进入详情；详情含标题、状态、类型·执行者、产出（有则显示完整路径）；可返回列表。
- 不恢复「外层壳 + 内层白卡」双层装饰；进度条与 Tab 行为不变。
- 相关单测 / lint 通过。

## 非目标（Non-goals）

- 不改 Daemon / 工作流协议或左栏过程对话。
- 不在详情内编辑节点或重跑单节点。
- 不重做制品/变更/事件 Tab。

## Impact

- `src/lib/workbench-daemon-review.js`（步骤字段透传）
- `src/workbench.js`（步骤微卡渲染、详情钻取、点击）
- `src/workbench-layout.css`
- `tests/workbench-templates.test.js` / 相关 projection 测试
