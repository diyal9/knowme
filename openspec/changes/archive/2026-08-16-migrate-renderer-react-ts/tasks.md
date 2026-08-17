## 1. Epic 纠偏

- [x] 1.1 完成定义改为 React 唯一渲染栈；禁止 LegacyHost
- [x] 1.2 重写 proposal / design / spec / parity / qa

## 2. 测试基建

- [x] 2.1 Vitest + RTL + api mock
- [x] 2.2 Playwright e2e 冒烟
- [x] 2.3 package.json：`test:renderer` / `test:e2e`；harness gate 纳入 renderer

## 3. 壳

- [x] 3.1 红测 shell-rail
- [x] 3.2 拆除 mountLegacyWorkspace
- [x] 3.3 AppShell + SideRail

## 4. Workspace features

- [x] 4.1 shelf（徽章、无 Demo 种子）
- [x] 4.2 taskhome
- [x] 4.3 run / HITL / 返回
- [x] 4.4 manage
- [x] 4.5 studio
- [x] 4.6 assistant（无文件可聊、Tab、composer）
- [x] 4.7 files / knowledge / capability overlay

## 5. 次要窗

- [x] 5.1 settings / list / memory / note / log-viewer React 页

## 6. 退役

- [x] 6.1 默认 Vite；运行时不 load 页面 html
- [x] 6.2 制作人 acceptance 清单更新
- [x] 6.3 Wave2-F：`git rm` 页面级 `src/*.html/js`（L0 契约迁至 `tests/fixtures/legacy-pages/` + React 组件断言）
