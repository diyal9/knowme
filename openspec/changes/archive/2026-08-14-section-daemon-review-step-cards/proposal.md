## Why

管线审阅「步骤」Tab 的节点微卡目前是整块单色底（标题与元信息同区），扫读层级弱。用户希望对齐专业工作流节点卡（上半彩色标题栏、下半白色内容区），一眼区分「谁在执行」与「节点名/产出」。

## What Changes

- 步骤微卡改为分区结构：上半标题栏（类型·执行者）+ 下半内容区（英文节点名、产出文件）
- 当前/错误态用标题栏底色强化，整卡不再整块铺橙/红底
- 保持 zigzag 时间线、点击钻取、字段语义与 `micro-daemon-node-step-cards` 约束（单卡内分区，不恢复外层壳+内层白卡）

## 目标用户

在工作台管线任务中查看节点进度的执行者。

## 验收标准

- 步骤列表每张卡可见彩色/浅色标题栏 + 白色内容区分隔
- 标题在标题栏；副标题与产出在内容区
- 当前节点标题栏偏暖橙，错误态偏红；默认浅灰蓝
- zigzag 左右对齐与点击进详情仍可用；无双层装饰壳

## 非目标（Non-goals）

- 不改 Studio 画布节点卡（已有 `wb-studio-flow-head`）
- 不改主进程 / Daemon API / IPC
- 不增加图标列、端口圆点或阴影堆叠

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pipeline-run-review-surface`: 步骤微卡须为上标题栏 + 下内容区的分区展示

## Impact

- `src/workbench.js`（步骤卡 HTML 结构）
- `src/workbench-layout.css`（分区样式与状态色）
- `tests/workbench-templates.test.js`（结构 class 断言）
