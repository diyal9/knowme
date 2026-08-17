# QA Plan: split-agent-run-and-studio-by-domain

## Smoke Scope

- [ ] Agent Run 创建 / launch / cancel / 子 Run 编排路径无回归
- [ ] 工具轮次、grounding、输出协议 v2 事件序列不变
- [ ] Studio model/canvas UMD 与 CommonJS 导出仍可用

## 定向测试

| 套件 | 覆盖 |
|------|------|
| `agent-run-executor.test.js` | run() 主路径 |
| `agent-run-executor-grounding.test.js` | grounding 相位 |
| `agent-team-runtime-core.test.js` | Manager + 状态机 |
| `agent-team-runtime-integration.test.js` | 集成编排 |
| `agent-runtime-production-readiness.test.js` | 生产就绪 |
| `workbench-studio-model.test.js` | Studio model（未拆回归） |
| `workbench-studio-canvas.test.js` | Studio canvas（未拆回归） |
| `workbench-studio-free-graph.test.js` | 自由图 |

## 硬门禁

- `npm run lint` — agent/studio 不新增 WARN；architecture hub 无 WARN
- 上述定向测 PASS
