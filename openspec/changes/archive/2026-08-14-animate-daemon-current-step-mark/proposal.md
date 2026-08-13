## Why

管线审阅「步骤」时间线里，当前执行节点的中轴圆点只有静态描边，看不出「流程正在这里」。用户扫读进度时无法一眼锁定活跃节点，削弱执行过程的在场感。

## What Changes

- 当前 / 执行中 / 等待中节点的中轴圆点增加持续、克制的脉冲动效（扩散环或等价呼吸），明确表达「流程正在此节点」。
- 已完成 / 待执行 / 失败节点保持静态态，不跟跳动效。
- 遵循 `prefers-reduced-motion: reduce`：减弱或关闭动画，仍保留当前态静态高亮。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pipeline-run-review-surface`：当前执行节点圆点 MUST 有可感知的进行中动效。

## Impact

- `src/workbench-layout.css`：步骤圆点动画与 reduced-motion
- 可能微调 `src/workbench.js` 仅当需补齐 `is-current` 标记类（优先纯 CSS）
- 测试：既有投影单测；开发自测步骤 Tab

## 目标用户

在管线运行审阅中盯进度、判断「现在卡在哪一步」的知识工作者与开发者。

## 验收标准

- 执行中任务打开「步骤」Tab：当前节点中轴圆点有持续脉冲/呼吸动效，一眼可辨。
- 非当前节点圆点无该动效。
- 系统开启「减少动态效果」时：无脉冲动画，当前节点仍有静态色/描边可辨。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改步骤投影逻辑、进度条、之字形卡片文案。
- 不改 Daemon 协议或左栏过程对话。
- 不做整卡闪烁或高饱和全卡动画。
