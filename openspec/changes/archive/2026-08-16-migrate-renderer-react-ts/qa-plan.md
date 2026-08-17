# QA Plan — migrate-renderer-react-ts

## Smoke Scope

- [x] `npm run test:renderer` — rail / shelf / assistant / run
- [x] `npm run test:e2e` — workspace 启动与 rail
- [x] 默认入口不再加载 `workspace.html`
- [ ] 制作人对照 Demo：助理发送、货架打开工作流、run 返回、设置窗

## Anti-patterns

- LegacyHost / 注入 workspace.html → fail
- 新文案或新导航项 → fail
- 渲染进程直接 ipc → fail
