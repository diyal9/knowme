# QA Plan: game-studio-work-partner-daemon

## Smoke Scope

- [x] 游戏行业空态展示四类任务场景
- [x] 策划需求案 parse/validate/approve 契约
- [x] Daemon offline 时 handoff 诚实阻断
- [x] Daemon online fixture 时 handoff 生成 workflow/slug
- [x] legacy agentId + game industry 场景路由
- [x] 左 Rail 按钮保留（静态/Electron 目检）
- [x] npm test 906 pass / lint pass / harness gate

## 反模式

- [x] Daemon 不可用时不显示 ready（契约测试）
- [ ] 真实飞书 OAuth（环境不可用，fixture 替代并在报告标注）
- [x] 无知识命中 / 权限拒绝路径（单元测试覆盖 handoff blocked）

## 环境

- OS: Windows 10
- Node: v24
- Electron: 31（真机 UAT 可选）
- Daemon: 127.0.0.1:8010（未启动时验证 offline 路径）
