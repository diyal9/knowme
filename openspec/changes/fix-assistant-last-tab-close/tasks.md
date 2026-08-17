## 1. Store：关最后 Tab 采纳新建 Session

- [x] 1.1 重写 `closeSessionTab`：调用 `agentSessionCloseTab`，若返回 `createdSessionId` 或打开集合为空，写入新 Tab 并 hydrate；勿用旧 sessions 覆盖 `setUi`
- [x] 1.2 `closeSessionTabs` 关空时走同一「保证有空白 Session」路径
- [x] 1.3 `assistant.spec.tsx` 覆盖「仅一 Tab 点关闭 → 出现新空白 Tab」

## 2. Chrome：关闭钮与左缘对齐

- [x] 2.1 `.agent-session-tab .tab-close`：激活常显、尺寸/hover 对齐系统 `.tab-close`
- [x] 2.2 收紧 Tab 条左 padding/margin，贴齐 `.agent-col-head` 左缘
- [x] 2.3 关闭控件使用文本 `×`（与系统 tab chrome 一致），避免 Icon 圆形底违和

## 3. 门禁

- [x] 3.1 `npm test` / `npm run lint` / `npm run typecheck:renderer`
