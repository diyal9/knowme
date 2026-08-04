# QA Plan: workbench-daemon-launch-context-defaults

## Smoke Scope

- [ ] 打开 Daemon 工作流弹窗时，若服务返回默认上下文，表单优先显示远程值
- [ ] Daemon 不支持默认上下文接口时，弹窗仍可正常打开并回退到本地缓存/占位符
- [ ] `PRD / asset 文件` 字段可提交 `PRD.md`
- [ ] `PRD / asset 文件` 字段可提交 `assets/mockup.png`
- [ ] 绝对路径与 `../` 穿越路径仍被拒绝

## Automated Checks

- [ ] `npm test`
- [ ] `npm run lint`
