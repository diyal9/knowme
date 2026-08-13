# QA Plan

## Smoke Scope

- 启动 KnowMe 并进入工作台 → 工作流。
- 确认搜索框下方只直接展示 Daemon `primary` 常用流程。
- 确认“高级工作流”默认收起，标题显示正确数量。
- 展开高级区域，点击任一流程可正常打开启动弹窗。
- 搜索一个仅属于高级区的流程，确认结果可见且可打开。
- 确认 Daemon `internal`、`deprecated` 流程及内部阶段名称不出现在目录与搜索中。

## Regression Scope

- Daemon 离线时，本地旧版工作流（无 `catalog`）仍作为常用流程展示。
- 首页工作流数量与目录中可见的常用 + 高级总数一致。
- 最近运行列表的独立折叠和任务打开行为不受影响。
- 工作流启动弹窗、DAG 预览和 Daemon 启动请求不受影响。

## Automated Checks

- `node --test tests/workbench-daemon-client.test.js tests/workbench-templates.test.js`
- `npm test`
- `npm run lint`
- `openspec validate align-workbench-workflow-catalog --strict`
