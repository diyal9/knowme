# QA Plan: perf-hygiene-refactor-closeout

## Smoke Scope

- [ ] 冷启动：工作台首屏可打开，无 IPC 报错
- [ ] 图标：Shelf / Hub / Manage / Run / TaskHome 列表与按钮图标正常
- [ ] 助手流式：发送消息，流式文本完整显示、无丢字
- [ ] Agent graph run：本地 graph 事件仍可查询（slice -120）
- [ ] `npm test` + `npm run lint` PASS

## Regression

- [ ] 专家协作 / 工作流货架 / 管线服务核心路径
- [ ] 助手多 tab 切换后会话隔离

## Anti-patterns

- [ ] 控制台无 uncaught error
- [ ] 流式过程中 UI 无明显卡顿尖峰（目视）
