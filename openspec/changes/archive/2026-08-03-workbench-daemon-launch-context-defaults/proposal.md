# Proposal: workbench-daemon-launch-context-defaults

## Why

当前 Workbench 的 Daemon 启动弹窗把远程执行上下文主要当作本地缓存表单来处理：

- 打开弹窗时默认值来自本地 `localStorage`，不是 Daemon 返回的真实默认上下文
- 当 Daemon 运行在远程环境、而本地没有对应仓库工作副本时，用户无法确认 `GitLab 项目 / 仓库`、`ref`、`commit`、输入制品目录是否真实有效
- `PRD 相对路径` 文案过窄，容易让用户误以为这里只能填写 `PRD.md`，而不能填写 `assets/mockup.png`、`assets/prd.pdf` 这类需求附件文件

这会让远程工作流的启动上下文既不可信，也不够清晰。

## Target Users

- 通过远程 Daemon 启动工作流、但本地没有对应仓库目录的办公与研发用户
- 需要依赖 Daemon 提供真实仓库默认值来减少手填错误的团队协作者
- 需要把 PRD Markdown、截图、PDF、原型图等需求附件一起传入工作流的用户

## What

- 为 Workbench 增加 Daemon 启动上下文默认值读取能力，弹窗优先展示 Daemon 提供的真实默认上下文
- 保留用户手动覆盖能力，但默认值来源从“本地缓存优先”调整为“Daemon 默认值优先，本地缓存兜底”
- 将 `PRD 相对路径` 扩展为 `PRD / asset 文件`，明确支持填写仓库内的 Markdown、图片、PDF 等需求附件路径
- 为新的 Daemon 默认上下文读取与 PRD asset 路径补充测试

## Non-goals

- 不在本次变更里实现本地文件选择器或附件上传 UI
- 不改造 Daemon 任务执行协议的核心结构，仍沿用现有 `context.protocolVersion = 1`
- 不把资源目录字段改造成完整的多文件清单编辑器
- 不处理需要登录态下载的远程附件

## Success

- 用户打开远程 Daemon 工作流弹窗时，若服务提供默认上下文，界面会优先显示这些真实值
- 当 Daemon 尚未实现该接口时，前端平滑退回现有本地缓存行为，不阻塞任务启动
- 用户可以在 `PRD / asset 文件` 字段填写如 `PRD.md`、`assets/mockup.png`、`assets/prd.pdf` 的仓库相对路径
- `npm test` 与 `npm run lint` 通过，相关单测覆盖新接口和 PRD asset 路径行为
