# Design: push-strict-score-to-96

## 性能证据

`scripts/strict-perf-bench.js` 用 git 取 `f6ad048` 的 `workspace.html` + `workspace-agent.js` 字节，对照当前助理首屏静态 CSS。Vitest 覆盖 100 条消息走 Virtuoso。不把 Electron 冷启动毫秒当作硬门禁（机器噪声大），但脚本可重复跑。

## 表面注册表

`surface-registry.tsx`：测试顶层 await 同步模块，生产 `lazySurface`。Vite 静态替换 `MODE`。AppShell 只 import 组件并按 route 挂载。

## 类型

`lazySurface<P extends object>` 返回 `LazyExoticComponent<ComponentType<P>>`。Settings/Run 导出 props 类型供注册表使用。
