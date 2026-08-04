# 开发自测报告

- 日期：2026-08-04
- Change：`swap-automation-capability-rail-order`
- `npm test`：PASS（892/892）
- `npm run lint`：PASS
- 定向测试：PASS（7/7）
- OpenSpec strict validate：PASS
- 手动冒烟：PASS

## 界面核对

- 静态本地预览中，工作台、能力 Hub、自动化的纵向坐标依次为 `80`、`114`、`160.8`。
- 能力 Hub 位于 `rail-top` 主导航分组；自动化位于分隔后的 toolbar，`aria-label` 为“自动化中心”。
- KnowMe 已重启，主进程成功启动且 Electron 主进程与渲染进程保持运行。
- 静态浏览器预览因没有 Electron preload 而出现 `window.api` 缺失提示，不属于真机运行错误。
