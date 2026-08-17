# QA Plan: unify-knowme-architecture

## Smoke Scope（必填）

- [ ] 应用启动 `npm start` 无崩溃
- [ ] 无「新建便签」入口；无便签总览窗
- [ ] rail：助理 / 工作台 / 专家库 / 知识网
- [ ] 货架可见；文件树无源时有设置引导
- [ ] 设置窗可开，可见模型或内容源区块

## Regression Scope

- [ ] 工作台 HITL 底栏文案仍在（返回工作流 / 再跑一次 / 查看执行过程）
- [ ] 助理可发送（无文件）
- [ ] 日志窗仍可从现有入口打开（若有）
- [ ] 托盘不依赖便签窗

## Anti-pattern Checks（测试专用）

- [ ] 未绑定内容源时 `@` 不冒便签列表
- [ ] 快速切换 rail 无白屏
- [ ] 关闭主窗不弹出便签

## 环境

- OS: Windows 10+
- 命令: npm start / npm test / npm run test:renderer
