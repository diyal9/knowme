# QA Plan — polish-workflow-run-surface

## Smoke Scope

- 货架点「开始」→ 确认输入：顶栏有工作流名+产出，卡片无重复标题/产出句
- 必填字段显示「必填」，无 `text`/`string` 字样
- 执行方式只读中文；有专家节点时可见参与专家
- 开始运行 → 执行中 → 产物 三段步进高亮正确
- 返回货架不中断进行中运行

## Deep Scope

- 缺必填点「开始运行」仍被拦
- 取消回货架
- 窄窗（~760px）顶栏与表单仍可用

## Out of Scope

- 执行内核正确性、Daemon 联调、专家任务房
