# QA Plan

## Smoke Scope

- [ ] 首页输入目标后进入准备状态，目标不会丢失
- [ ] 从准备状态进入团队/能力入口后返回，目标和工作流仍在
- [ ] Daemon 创建任务、启动任务、轮询、等待 gate/clarification、完成和失败
- [ ] 失败任务显示重新启动/详情动作，不显示完成
- [ ] 完成任务显示制品并能打开合法本地制品
- [ ] 完成且有产物时，协作区直接展示结果入口，不显示内部事实串或审批/澄清引导
- [ ] 完成但无产物时显示“已完成 · 无产物”，可查看执行过程或再跑一次，不暗示已经交付
- [ ] Agent Graph、本地团队和 Daemon 返回的文件/URL 产物均能进入统一结果投影
- [ ] 最近任务在终态后刷新，应用重载后可重新打开
- [ ] 默认窗口与窄窗口无横向溢出

## Regression Scope

- `tests/workbench-daemon-client.test.js`
- `tests/workbench-task-projection.test.js`
- `tests/workbench-task-brief.test.js`
- `tests/workbench-templates.test.js`
- Agent Service 与 Agent Runtime 既有测试
- 便签编辑、设置页、能力中心和团队绑定基础流程

## Anti-pattern Checks

- [ ] 失败/取消任务不显示为成功完成
- [ ] 启动请求失败时不显示“任务已开始”
- [ ] 不把 `terminal` 当作成功
- [ ] 不丢失用户目标、不强迫重复输入
- [ ] 不出现无动作的空状态
- [ ] 完成态不显示 `状态: done`、`等待类型` 等模型 grounding 文本
- [ ] 完成态不显示“通过/修订/澄清”“补充材料”等运行中操作
- [ ] 不把任务输入或纯日志提升为产物
- [ ] 不新增任意 IPC request bridge
- [ ] 不调用 `/agent/v1` cancel/resume 伪装 Workbench 恢复
- [ ] 不打开未经校验的任意 artifact 路径
- [ ] 不引入控制台 uncaught error

## Automated Checks

```bash
npm test
npm run lint
node .cursor/scripts/harness.js gate --json
```

OpenSpec change validation and the loopback Electron smoke are required before producer acceptance.
