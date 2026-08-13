# QA Plan: establish-composable-agent-workbench

## Smoke Scope（必填）

- [ ] 首次打开工作台默认进入日常办公模式，三类工作模式均可切换
- [ ] 软件研发模式显示并可启动现有 Daemon 工作流，最近任务可继续
- [ ] 日常办公与视觉创作模式不展示虚假编码流程，并提供添加 Agent/能力入口
- [ ] 从 Capability Hub 安装或启用 Expert 后可添加到当前工作台
- [ ] 团队页立即显示新增 Agent，重复添加不重复，移除不卸载 Expert
- [ ] 重启应用后恢复当前模式和团队绑定

## Regression Scope

- [ ] Capability Hub “开始对话”仍创建可恢复 Expert Session
- [ ] 工作台今日待办、工作流搜索、启动关系图、任务工作间和产物打开不回归
- [ ] 自动化独立入口和页面不受工作台 Tab 调整影响
- [ ] Daemon 离线时研发模式友好降级，其他模式仍可配置
- [ ] 窄窗口无横向溢出，模式切换器、Tab 和团队操作可键盘访问

## Anti-pattern Checks（交给测试）

- [ ] 首页是否仍像固定专家 Demo，而不是用户自己的工作空间
- [ ] “专家 / Agent / 内置角色 / 专业能力”是否出现难以区分的同名心智
- [ ] 未接通能力是否被误呈现为可运行或已完成
- [ ] 添加 Agent 是否偷偷扩大权限、自动授权连接器或误删能力
- [ ] 切换工作模式后历史任务是否无故消失或被错误归类
- [ ] 用户是否必须理解 Daemon 才能判断下一步

## Evidence

- 自动化测试：`evidence/dev-self-test.md`
- 测试报告：`evidence/test-report.md`
- 截图：`evidence/screenshots/`
