## 1. Scaffold

- [x] 1.1 创建分支 `refactor/renderer-react-ts` 并记录基线 commit
- [x] 1.2 添加 Vite + React + TS 工程（`src/renderer/`、`vite.config.ts`、`tsconfig.json`）
- [x] 1.3 `package.json` 增加 `renderer:dev` / `renderer:build` / `typecheck:renderer` 与依赖
- [x] 1.4 落地 `src/shared/api.d.ts`（`window.api`）
- [x] 1.5 `main.js` 实现 `KNOWME_RENDERER` 双入口（默认 legacy）
- [x] 1.6 `prebuild.js` 在打包前调用 `renderer:build`
- [x] 1.7 空壳 React workspace 可在 vite 模式下打开并调用至少一次 `window.api`

## 2. Workspace shell & surfaces

- [x] 2.1 React App 壳：chrome / side rail / 内容岛布局（对齐现有 CSS 变量）— via LegacyHost + boot CSS
- [x] 2.2 路由：助理 vs 工作台；工作台 surface 切换 — hosted + mode telemetry
- [x] 2.3 LegacyHost：在 React 容器旁挂载现有 workbench DOM + 脚本以保对等
- [x] 2.4–2.9 shelf / taskhome / run / manage / studio / 助理 — `surfaces/registry.ts` 标记 hosted，parity 对等

## 3. Parity & gate

- [x] 3.1 填写 `parity-matrix.md` 状态
- [x] 3.2 `npm test` / `lint` / `typecheck:renderer` — 1882 pass / lint ok / tsc ok
- [ ] 3.3 制作人 acceptance 对比通过
- [x] 3.4 分支已推送；PR 链接见 acceptance（本机无 `gh` CLI，需在 GitHub 网页创建）

## 4. Secondary windows (follow-up)

- [x] 4.1 settings / list / memory Vite 入口与开关
- [x] 4.2 note / log-viewer 入口骨架
- [ ] 4.3 各自小 PR 对比合入（首 PR 可含骨架；细验收可后续）
