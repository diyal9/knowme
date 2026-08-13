# 开发自测：可组合 Agent 工作台

日期：2026-08-07  
结论：通过

## 实现核对

- 工作模式：内置日常办公、软件研发、视觉创作；默认日常办公，切换与 Agent 绑定持久化到用户数据目录。
- 执行边界：软件研发继续投影现有 Daemon Agent、workflow 与 task；其他模式无可运行流程时展示真实空态。
- 组队闭环：Capability Hub 可安装/启用 Expert 后添加到当前模式；团队页即时刷新，支持安全移除且不卸载能力。
- 安全边界：主进程校验模式与 Expert ID、安装启用状态和绑定上限；Renderer 仅消费受限 DTO。

## 自动化验证

- `npx openspec validate establish-composable-agent-workbench --strict`：通过。
- `npm test`：1408/1408 通过，0 失败。
- `npm run lint`：`lint ok`，`script-scope ok`。
- `node --test tests/workbench-mode-store.test.js tests/workbench-templates.test.js tests/capability-hub.test.js tests/workspace-capability-rail.test.js`：57/57 通过。

## Electron 冒烟

执行：

`node openspec/changes/establish-composable-agent-workbench/evidence/workbench-mode-electron-smoke.js`

结果：9/9 检查通过，Renderer 控制台业务错误 0。

覆盖：

- 首次默认日常办公，三种模式可切换。
- 软件研发模式显示真实研发工作流。
- 日常办公模式从 Capability Hub 添加低风险 Expert，团队页立即可见。
- 视觉创作不继承研发工作流，展示添加 Agent 的真实下一步。
- 重载后恢复视觉创作模式。
- 1360×860 无横向溢出。

证据：

- `evidence/workbench-mode-electron-smoke.json`
- `evidence/screenshots/workbench-office-overview.png`
- `evidence/screenshots/workbench-office-team.png`

## 后续门禁

- 自定义工作模式、工作流编辑器、图像供应商与调度器不在本次范围。
- 制作人体验验收与测试角色反模式 QA 尚未执行，不在开发自测中代签。
