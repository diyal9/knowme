## Why

Daemon 任务节点详情顶栏左侧的「返回步骤」文案按钮偏冗长，与工作台其它详情/抽屉「右上角关闭」习惯不一致。用户期望一眼能关掉详情回到步骤列表，而不是阅读导航文案。

## What Changes

- 节点详情顶栏：移除「← 返回步骤」文案按钮
- 改为右上角关闭图标（`close`），点击后回到步骤列表（行为不变）
- 保留无障碍：`title` / `aria-label` 说明「关闭详情」

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `pipeline-run-review-surface`：节点详情的退出入口由左侧文案返回改为右侧关闭图标

## Impact

- `src/workbench.js`：`renderDaemonStepDetail` 按钮结构
- `src/workbench-layout.css`：详情顶栏与关闭按钮布局
- `tests/workbench-templates.test.js`：断言关闭图标标记（保留 `data-step-detail-back`）

## 目标用户

在管线审阅「步骤」中查看单个节点详情的 C 端用户。

## 验收标准

- 节点详情右上角可见关闭图标，左侧无「返回步骤」文案
- 点击关闭后回到步骤微卡列表
- 键盘/读屏可通过按钮名称理解用途

## 非目标（Non-goals）

- 不改动详情字段内容与步骤微卡布局
- 不改动审阅底栏「返回」等其它导航
- 不引入新的确认弹窗
