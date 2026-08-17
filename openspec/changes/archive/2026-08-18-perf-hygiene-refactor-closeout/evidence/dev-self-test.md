# 开发自测报告

- 日期：2026-08-18
- Change：perf-hygiene-refactor-closeout
- 分支：refactor/renderer-react-ts

## 门禁

| 检查项 | 结果 | 说明 |
|--------|------|------|
| npm test | FAIL（1/1637） | `cursor-capability-repository.test.js` Windows EPERM rename 偶发失败，与本次 change 无关 |
| npm run lint | PASS | architecture / nocheck / script-scope 均通过 |
| useKnowMeIcons.spec.tsx | PASS | 2/2 |
| workspace-init 静态断言 | PASS | `split-entry-ipc-workbench.test.js` 内含 `notes: []`、无 `loadAllNotes` |

## 实现核对

### P0-1 图标作用域 mount
- `useKnowMeIcons(dep, rootRef)`：无 root 时 no-op
- `mountKnowMeIcons(root)` 强制作用域；`ui-icons.js` mount 移除 document 默认
- 8 个 surface（AppShell / Shelf / Hub / Run / Manage / TaskHome / Expert / DaemonComposePanel）均挂 `surfaceRef`/`shellRef`
- 删除 `sticky-icons.ts` / `useStickyIcons.ts`

### P0-2 workspace-init
- 冷启动返回 `notes: []`、`groups: []`，不调用 `loadAllNotes`
- `loadAllNotes` 保留并注释禁止冷启动路径

### P1-1 流式节流
- `store-session.ts`：pending buffer + rAF/32ms fallback；detach/切换前 flush

### P1-2 有界事件 Map
- `runtime-store.ts` 新增 `createEvictingEventMap`
- `boot.ts`：`workbenchAgentRunEvents` maxEntries=64、ttl=24h

### P1-3 命名卫生
- `KNOWME_PROMPT_SPACE_DIR` 优先，兼容 `STICKY_PROMPT_SPACE_DIR`
- shell/ipc-deps 注释「notes 数据兼容」；错误文案改为 KNOWME 前缀

## 手动冒烟

- 未启动 Electron（本 change 为性能/内存卫生，无 UI 布局变更）
- 逻辑审查：Icon/TreeIcon 仍对局部元素 mount；surface hook 仅扫各自根节点

## 备注

- 全量 test 失败项为 Windows 临时目录 atomic rename 竞态，可重跑验证
- `boot.ts` 工作区另含 GPU 策略改动（非本 change scope），未回滚
