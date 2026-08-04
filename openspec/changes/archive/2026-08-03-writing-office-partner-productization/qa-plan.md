# QA Plan: writing-office-partner-productization

## Smoke Scope

- [ ] 写作空态展示“写需求文档 / 写办公文档 / 按提纲成稿 / 排版定稿”四类主任务
- [ ] `Ctrl/Cmd+K` 打开写作快捷菜单后，能看到与四类任务一致的动作，并保留“润色去 AI 味”
- [ ] 输入一句目标 + 若干要点，可生成结构化需求文档草稿，并减少明显 AI 腔
- [ ] 输入标题 + 提纲，可生成段落完整、事实不乱补的成稿
- [ ] 长文默认进入右侧审阅区，可继续写入当前编辑器
- [ ] 生成飞书文档草稿时进入 pending_review；确认前不直接写入飞书

## Regression

- [ ] 通用办公、知识管家、研发助手三种模式的空态入口不受影响
- [ ] 现有“应用到文件 / 替换全文 / artifact 审阅”路径保持可用
- [ ] 现有 `feishu.draft_minute_permission` 与 `feishu.draft_write_doc` 审批链路不被破坏

## Anti-pattern Checks

- [ ] 需求文档不会被“去 AI 味”洗成口语化散文
- [ ] 办公文档不会残留大量“此外 / 至关重要 / 赋能 / 深度”等高频 AI 套话
- [ ] 短文不会被强制送入右侧审阅，避免工作流过重
