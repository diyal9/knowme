## Why

能力 Hub 当前首屏条目不多时可以正常使用，但搜索会在每次输入时完整重绘目录，卡片动画又按条目索引持续递增延迟。能力目录扩展后，用户可能把“等待动画”误认为卡顿，搜索反馈也会变慢。现在先收紧渲染节奏，可以在不改变能力管理流程的情况下保持首屏轻快。

目标用户：使用能力 Hub 搜索、筛选和选择专家的 KnowMe 用户。

## What Changes

- 为搜索输入增加短防抖，避免连续输入触发多次完整目录重绘。
- 限制卡片和精选卡片的入场动画延迟上限，避免条目增多后长时间逐项出现。
- 保留现有搜索、筛选、响应式布局和 reduced-motion 行为。
- 增加静态契约测试，确保优化参数不会被后续样式或脚本修改意外移除。

验收标准：

- 连续输入搜索词时，目录不会为每个按键立即重复渲染。
- 目录卡片的最大入场延迟不超过 300ms。
- 搜索结果、分类筛选、已安装筛选和卡片点击行为不变。
- `npm test`、`npm run lint` 和 OpenSpec strict 校验通过。

非目标（Non-goals）：

- 本变更不引入虚拟列表、分页或新的前端依赖。
- 不改变能力目录数据结构、IPC API 或安装流程。
- 不调整现有卡片数量、布局列数和产品信息架构。

## Capabilities

### New Capabilities

- `capability-hub-rendering`: 约束能力 Hub 的搜索反馈和卡片渐入渲染行为。

### Modified Capabilities

- 无

## Impact

- 影响 `src/capability-hub.js` 的搜索事件调度。
- 影响 `src/capability-hub.css` 的卡片动画延迟计算。
- 更新 `tests/capability-hub.test.js` 的静态行为契约。
- 不增加依赖，不改变主进程和 IPC。
