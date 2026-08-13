# UI 冒烟证据 — Capability Fabric

- 日期：2026-08-04
- 页面：`capability-hub.html`
- 方式：Playwright 静态预览 + Electron 当前工作区启动
- 结论：PASS

## 覆盖

- 专家、技能、MCP 连接器三个既有 Tab 均可切换，单层顶部栏保持不变。
- 详情抽屉显示元信息、依赖、权限、输入/输出、风险与来源。
- 抽屉打开时遮罩阻止后台点击；关闭后可继续切换 Tab。
- 静态预览控制台仅有 `favicon.ico` 404，不属于产品错误。
- Electron 从 `D:\aispace\knowme` 启动，主进程日志正常，renderer `app-path` 指向当前工作区并持续运行。

## 截图

Playwright 服务将截图写入受限的本机输出目录：

- `C:\Users\Administrator\hub-tab-experts.png`
- `C:\Users\Administrator\hub-tab-skills.png`
- `C:\Users\Administrator\hub-tab-connectors.png`
- `C:\Users\Administrator\hub-drawer-governance.png`

截图只使用 mock catalog 验证 UI 结构；真实 IPC、依赖阻断、风险确认和 Connector 单源路径由自动化测试覆盖。
