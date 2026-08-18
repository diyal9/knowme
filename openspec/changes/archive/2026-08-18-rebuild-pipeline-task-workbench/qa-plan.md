# QA Plan: rebuild-pipeline-task-workbench

## Smoke Scope（必填）

- [ ] 打开工作台 → 「管线服务」→ 左侧为管线任务管理，「+ 新建任务」可见
- [ ] 在线：新建任务 → 填目标（≥20 字）→ 看 ingest 清单 → 开始开发 → 列表出现新任务
- [ ] 选中任务 → 右侧展示状态/审阅，不回到路径开工台
- [ ] 离线：新建/开工被正确阻止，有重试入口
- [ ] 缺 hard ingest（模拟）时「开始开发」不可用
- [ ] 筛选「需要你 / 进行中 / 已完成」与搜索可用

## Regression Scope

- 顶栏「任务」（本机专家）列表与创建不受影响
- 「工作流」货架与启动不受影响
- Daemon launch-context 404 仍可创建（回退清单）
- 既有门禁/澄清运行页入口仍可打开产物或处理动作

## Anti-pattern Checks（交给测试）

- 用户是否把管线任务列表误当真·顶栏任务
- 空列表时是否只会「发呆」——缺新建引导
- ingest 文案是否过于工程化（路径 slug 裸奔）
- 对话框是否挡主操作或双重确认过多
- 窄窗口下双栏是否挤爆、按钮不可点

## Evidence

- `evidence/dev-self-test.md`
- `evidence/screenshots/`
- `evidence/test-report.md`（测试阶段）
