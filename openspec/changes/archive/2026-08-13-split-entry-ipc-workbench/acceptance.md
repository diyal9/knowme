# 制作人体验验收: split-entry-ipc-workbench

## 核心路径（行为不变验收）

- [x] 主进程 IPC 经 `registerCoreIpc` 挂载；`main.js` 内联 `ipcMain.handle/on` = 0
- [x] 合同测试覆盖 `src/ipc/*` 域模块与 deps 注入
- [x] 设置 / 内容源 / 外链 / notes / workbench / agent / game / skills / logs 通道仍由 ipc 模块注册
- [x] 工作台 provenance / run-phase / escape / labels 浏览器助手可复用
- [x] `npm test` / `npm run lint` 硬门禁通过（开发自测证据）

## 体验标准

- 本 change 为入口模块化（strangler），**不改变** C 端可见交互语义
- 无新增弹窗/打扰；无产品面视觉改动
- Success 标准（proposal）：main 经 deps 挂载、行为不变、测试/lint 通过

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-13
- 备注：基于开发自测 + 合同/全量回归证据验收；建议测试按 qa-plan Smoke 做一次启动冒烟后归档。
