# Agent Graph Runtime 开发验证

## 结果

- `npm test`：通过，1438/1438。
- `npm run lint`：通过，`lint ok`、`script-scope ok`。
- `openspec validate workbench-agent-graph-runtime --strict`：通过。
- `node .cursor/scripts/harness.js gate --json`：硬门禁通过；仓库已有其他活动变更存在 Advisory。
- `npm start`：Electron 主进程启动并正常退出，日志未出现 uncaught error。

## 针对性测试

- `node --test tests/workbench-agent-graph.test.js`：5/5 通过。
- `node --test tests/workbench-agent-runtime.test.js`：2/2 通过，覆盖串行 Team Run、handoff 和 gate 阻塞。
- `node openspec/changes/workbench-agent-graph-runtime/evidence/workbench-agent-graph-electron-smoke.js`：通过；覆盖目标输入、双 Agent Graph 提案、确认按钮以及未配置 API 时阻止启动并保留提案。
- 覆盖串行、并行、gate、terminal、未知 Agent、环、悬空边、handoff 和快照哈希。

## 未覆盖

- 本报告未将真实外部模型 API 作为测试依赖。
- Electron 烟测暂未驱动真实多 Agent Run、gate 放行与重载恢复；这些路径仍需配置可控的本地模型端点后由制作人与测试角色验收。
- 制作人体验验收和测试角色正式 QA 需在配置了本地 Agent 能力与 API 的桌面环境继续执行。
