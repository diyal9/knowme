# Code Review: workbench-honest-runner-state

角色：开发（自审）  
日期：2026-08-03

## 变更文件

- `src/lib/workbench-task-projection.js`：占位标记、用户化 degradedReason、`summarizeRunnerProgress`
- `src/lib/workbench-task-brief.js`：输入/产物分类，下一步建议不再把输入当产物
- `src/lib/workbench-presenter.js`：`sanitizeChatSuggestion`
- `src/lib/workbench-repo.js`：`resolveArtifactOpenPath`（拒穿越、相对→仓库根）
- `src/main.js`：artifact-open 使用上述解析
- `src/workbench.js`：诚实进度、状态一致、degraded 出口、友好 toast
- `src/workspace-agent.js`：任务上下文过滤内部路径产物标签
- `src/workspace.html`：degraded 出口样式
- 测试：projection / brief / presenter / repo / templates

## 审查要点

- **无回归**：`npm test` 761/761；`npm run lint` ok
- **安全**：产物相对路径经 `resolveUnderRoot`，拒绝 `..` 与绝对路径伪装
- **信任**：degraded 不再假 100%；输入路径不进「已有产物」
- **出口**：内容源设置复用既有 `openSettings('sources')`，无新 IPC
- **边界**：无输入配置时 Daemon 真产物（含 brief.md）仍可展示；仅匹配 `inputs` 的路径被标为 input

## 结论

开发侧通过。真机 degraded Daemon 会话建议制作人/测试再扫一眼（ADVISORY）。
