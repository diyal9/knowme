# Tasks: writing-office-partner-productization

- [x] 1. 新建 `writing-office-partner-productization` change 工件与 specs 增量，明确写作入口、去 AI 味和飞书草稿审阅路径
- [x] 2. 重构 `src/workspace-agent.js` 的写作空态卡片、快捷文案和 `Ctrl/Cmd+K` 写作任务菜单
- [x] 3. 扩展 `src/lib/conversation-grounding.js` 与写作 scene 提示，使其识别需求文档、办公文档、提纲成稿、排版定稿与润色去 AI 味
- [x] 4. 新增本地 Humanizer 风格后处理模块，并把它接入写作结果默认管线
- [x] 5. 为长文输出补充 draft artifact 与飞书文档草稿动作，复用现有 pending_review / accept / reject 机制
- [x] 6. 更新相关测试，覆盖写作入口、去 AI 味规则接入、artifact/Feishu 草稿链路与回归路径
- [x] 7. 执行 `npm test`、`npm run lint`，补写开发自测证据
