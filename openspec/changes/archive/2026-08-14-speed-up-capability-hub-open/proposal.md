## Why

从侧栏打开「能力」时，宿主每次重建 iframe，且 Hub 在首屏渲染前串行等待多路 IPC（目录、编辑器 catalog、composition、工作台绑定）。用户把这段等待感知为卡顿；仅靠入场动画无法解决。现在收紧打开路径，可在不改能力管理流程的前提下让首屏可交互更快。

目标用户：频繁在工作台与能力 Hub 之间切换的 KnowMe 用户。

## What Changes

- 关闭能力 Hub 时保留 iframe 实例（park），再次打开时复用，避免冷启动整页。
- 打开其它占用 `drawerBody` 的中心面时，先 park 能力 Hub，避免误销毁。
- Hub 目录加载改为渐进：当前 Tab 主目录返回后立即结束 skeleton 并渲染；编辑器 catalog / composition / 工作台绑定在后台补齐。
- 复用打开时可用轻量同步刷新工作台绑定，不阻塞已有目录展示。
- 增加静态契约测试覆盖 park/reuse 与渐进加载。

验收标准：

- 首次打开仍显示骨架，但主目录到达后即可浏览与点击卡片，不必等辅助数据全部完成。
- 关闭后再打开能力 Hub，若 park 仍有效则不再重建 iframe，内容可立即可见。
- 切换知识库/设置等中心面不会泄漏已 park 的 Hub；再次打开能力仍可复用或按需重建。
- 搜索、筛选、安装、详情抽屉、深链选中专家行为不变。
- `npm test`、`npm run lint` 通过。

非目标（Non-goals）：

- 不引入虚拟列表、分页或新前端依赖。
- 不改变 capability catalog IPC 协议与安装/卸载流程。
- 不做主进程目录扫描策略大改。
- 不重做卡片视觉或信息架构。

## Capabilities

### New Capabilities

- `capability-hub-open-perf`: 约束能力 Hub 打开时的 iframe 保活与渐进首屏加载行为。

### Modified Capabilities

- `capability-hub`: 新增主目录可先于辅助数据交互的要求（骨架不得挡住已到达的主目录）。

## Impact

- `src/workspace.js`：open/close/park/reuse 能力 Hub iframe。
- `src/capability-hub.js`：`loadCatalog` 渐进渲染与复用打开时的轻量刷新。
- `tests/workspace-capability-rail.test.js`、`tests/capability-hub.test.js`：静态契约。
- 不新增依赖；不改主进程 API 形状。
