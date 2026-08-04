# Design: workbench-daemon-launch-context-defaults

## 架构

本次变更保持现有 Electron 主进程 + Renderer Workbench + 远程 Daemon HTTP client 架构，不引入新的存储系统。

1. `src/lib/workbench-daemon-client.js`
   - 新增 Daemon 启动上下文默认值读取能力
   - 统一清洗 Daemon 返回的部分上下文字段，保证仍受相对路径校验
2. `src/main.js` + `src/preload.js`
   - 暴露新的 IPC 接口给渲染进程读取某个 workflow 的默认上下文
3. `src/workbench.js`
   - 打开 Daemon 启动弹窗时异步请求默认上下文
   - 渲染时采用“Daemon 默认值优先，本地缓存兜底”
   - 扩展 PRD 字段文案，明确支持 asset 文件路径
4. `src/lib/workbench-task-context.js`
   - 补充“部分上下文默认值”的安全标准化能力，避免把不完整默认值误当成正式提交上下文
5. `tests/*`
   - 补充 client、context 和模板/UI 相关测试

## 进程边界

| 层 | 位置 | 责任 |
|----|------|------|
| Renderer | `src/workbench.js` | 打开弹窗、展示默认值、允许手动覆盖 |
| Main / Node | `src/main.js` | 调 Daemon client、转发 IPC、屏蔽网络细节 |
| Shared logic | `src/lib/workbench-task-context.js` | 路径与上下文结构安全清洗 |
| Remote service client | `src/lib/workbench-daemon-client.js` | HTTP 请求、错误归一化、返回结构兼容 |

## Daemon 默认上下文读取

新增一个只读读取动作，输入为 workflow id，输出为 Daemon 对该工作流建议的默认上下文。

为了兼容远程服务渐进升级，client 需要接受以下几类返回包裹：

- 整体 body 就是上下文对象
- `body.context`
- `body.defaults`
- `body.launch_context` / `body.launchContext`

如果 Daemon 暂未实现该接口并返回 404，前端不得报错阻断，只需静默回退到现有本地缓存行为。

## 默认值合并策略

弹窗渲染时使用以下优先级：

1. Daemon 返回的默认上下文
2. 本地缓存的历史填写值
3. 现有占位符

这样能避免旧的本地缓存长期覆盖远程真实仓库信息，同时仍给未升级 Daemon 或缺失字段的情况保留兜底。

## PRD / asset 文件语义

现有协议里的 `inputs.prd` 继续保留字段名不变，但语义扩展为：

- 允许填写需求文档 Markdown，例如 `PRD.md`
- 允许填写需求附件文件，例如 `assets/mockup.png`、`assets/prd.pdf`
- 仍必须是仓库内相对路径，不能是绝对路径，也不能穿越目录

本次只扩展文案和校验说明，不新增多文件数组字段，避免和 `resources` 字段职责重叠。

## 风险与权衡

- 若 Daemon 默认值与用户上次手填不同，界面会优先展示 Daemon 返回值；这更接近“真实执行上下文”，但可能让少数用户觉得旧值被覆盖
- 由于远程 Daemon 接口尚可能未上线，前端必须把“接口缺失”当作可接受状态，而不是错误
- `inputs.prd` 语义扩宽后，需要避免误导用户把整个资源目录填进单文件字段，因此文案中强调“文件”
