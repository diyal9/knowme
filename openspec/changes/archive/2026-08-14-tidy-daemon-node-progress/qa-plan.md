# QA Plan: tidy-daemon-node-progress

## Smoke Scope（必填）

- [ ] 打开含多节点产出的管线审阅「步骤」Tab，确认副文案无「kind · artifacts/...」长串
- [ ] 确认有产出节点显示短文件名；无产出节点无多余空行
- [ ] 窄栏下副文案省略，时间线节奏整齐

## Regression Scope

- 进度条 n/total、当前节点高亮、降级空态
- 制品 / 变更 / 事件 Tab

## Anti-pattern Checks（交给测试）

- 副文案是否又把内部标识当主文案
- 是否靠换行「塞下」信息而不是分层
