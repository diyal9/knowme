# 开发自测报告

- 日期：2026-08-13
- Change：`add-daemon-purpose-title`
- npm test: PASS（1744）
- npm run lint: PASS
- 手动冒烟: PASS（主链路脚本）
- 备注：
  - 右栏步骤头新增 `Daemon 阶段 · {目的标题}`；LLM 经 `aiSuggestTitle` 异步提炼，失败回退 compact
  - 主链路：`evidence/daemon-mainchain-check.js` → overview / task / progress PASS；launchContext 对本机 Daemon 为 unsupported（软跳过，非阻断）
  - 截图中 ProtoDesigner `run_task` 超时属远端 Agent API 失败；KnowMe 编排读链路与标题投影已确认可用，按约定 API 失败处停止、不重跑轰炸
