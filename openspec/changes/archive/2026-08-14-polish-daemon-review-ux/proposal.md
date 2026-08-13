## Why

管线审阅右栏（步骤 / 制品 / 变更 / 事件）仍有「米色壳套白卡」、底栏偏深、底栏按钮纯文字，以及步骤页文字堆叠看不出编排进度。变更 Tab 缺少与 Daemon WebUI 对齐的「代码工作区」浏览器，用户无法在任务工作树里扫读代码。

目标用户：审阅失败/进行中管线结果、需要看步骤进度与代码变更的知识工作者。

## What Changes

- 压平审阅面层次：去掉卡套卡与深色底栏，与浅色表面体系统一。
- 底栏操作改为「图标 + 两字」按钮（刷新 / 重跑 / 返回）。
- 步骤 Tab 改为编排进度时间线：可见当前节点、完成比例、状态色；降级态用紧凑说明而非嵌套错误卡。
- 变更 Tab 展示制品变化，并提供「代码工作区」入口；点击打开与 Daemon WebUI 同构的左右分栏文件树 + 内容预览（`/workspace/tree` + `/workspace/blob`）。

## Capabilities

### New Capabilities

- `daemon-code-workspace`：任务代码工作区浏览器（只读树 + blob）。

### Modified Capabilities

- `pipeline-run-review-surface`：审阅面视觉扁平化、步骤进度呈现、底栏按钮形态、变更区工作区入口。

## 验收标准

- 审阅主内容区无「外米色壳 + 内白卡」双层装饰；底栏背景与内容面同属浅色，不显得深色条带。
- 底栏主操作按钮均为图标 + 恰好两字文案。
- 有真实节点时步骤页可见进度（当前步高亮 / n/total）；降级时不堆叠成嵌套错误卡。
- 变更 Tab 可打开代码工作区弹窗；树与文件预览走 Daemon workspace API；关闭/刷新可用。
- 相关静态契约与单测通过。

## 非目标（Non-goals）

- 不改 Daemon 服务端 workspace API 语义。
- 不引入 highlight.js 全量依赖（预览可先纯文本转义；后续可增强）。
- 不重做左栏过程对话。

## Impact

- `src/workspace.html`、`src/workbench.js`、`src/workbench-layout.css`、`src/workbench-shelf.css`
- `src/lib/workbench-daemon-client.js`、`src/preload.js`、`src/main.js`
- 新增 `src/lib/workbench-daemon-workspace.js`（可选）
- 测试：`tests/workbench-templates.test.js`、daemon client / review 相关
