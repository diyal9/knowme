# QA Plan

## Smoke Scope

- [ ] 工作台进入是单一工作流货架，无顶部 Tab
- [ ] 货架同格混排团队与个人工作流，各带「团队」/「我的」标签；领域筛选默认全部
- [ ] 工作台无任何 Agent 创建/编辑/调优入口；相关操作跳转能力界面
- [ ] 能力界面可新建自建 Agent，可对专家调优（配 Skill/知识库范围/Tool）
- [ ] 官方专家只读、可「复制为自建」再调优；专家目录无 Mock 占位
- [ ] 能力界面新建/安装一个 Agent 后，工作台编排节点候选出现该 Agent
- [ ] 编排「新建工作流」拖 Agent 连 DAG 保存 → 以「我的」标签即时进货架
- [ ] 编排节点检查器只设步骤目标，无 Agent 本体配置项
- [ ] 管理抽屉只有执行后端 + 自动化两面板
- [ ] 助理「我的专家」与能力界面同一份数据，助理侧不可增删改

## Regression Scope

- [ ] 运行三段式、返回与重启恢复不回归
- [ ] 旧存档 `activeWorkMode` / `shelfSource` 不导致空白或报错
- [ ] 已安装专家的对话（startExpert）不回归
- [ ] 窄窗(760px)货架与能力界面表单不破版

## Anti-pattern Review（测试角色重点）

- [ ] Agent 是否真的只有能力界面一处能增删改（无残留第二处）
- [ ] 编排里是否残留 Agent 本体配置（应只剩步骤目标）
- [ ] 货架标签是否会误标来源
- [ ] 能力界面去 Mock 后空态是否诚实（不再占位）

## Automated Checks

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx openspec validate relocate-agent-authoring-to-capability-hub --strict`
- [ ] Electron 冒烟脚本
