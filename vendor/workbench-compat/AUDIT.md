# Workbench 外部 Patch 审计（只读）

审计时间：2026-08-04  
第二仓库路径：`D:/workflows/workbench`（未 reset/checkout/commit/push）

## 上游锚点

| 项 | 值 |
|---|---|
| HEAD（已提交） | `ae2de9c502dc2b7d96cb3dcdbaaf0173813b914b` |
| 工作区 | 2 个 Python 文件未提交修改 |

## 差异摘要

| 文件 | 变更 | 目的 |
|---|---|---|
| `tools/workflow_runner/daemon/__main__.py` | +19/-1 | 新增 `_workflow_requires_cli()`；script workflow 自动 `skip_cli_preflight` |
| `tools/workflow_runner/orchestrator/loop.py` | +20/-1 | spawn 时按 workflow `cli_required` 传递 `--skip-cli-preflight` |

完整 unified diff 见 `patches/knowme-cli-required-v1.patch`。

## 协议结论

1. **Workflow schema** 已支持 `cli_required: false`（KnowMe `.cursor/workflows/game-dev-delivery.json`）。
2. **Daemon/Orchestrator 上游（ae2de9c）** 不读取该字段；无 `CURSOR_API_KEY` 时 script workflow 仍会 CLI preflight 失败 exit 1。
3. **`/api/health`** 无 compat / cli_required 能力字段，KnowMe 通过安装目录文件哈希 + marker 探测。

## KnowMe 生产方案

- 版本化 patch + `manifest.json` 锚定 pre-patch SHA256
- `src/lib/workbench-bootstrap.js`：幂等部署 workflow、校验后应用 compat（未知版本诚实阻断）
- 设置页：安装目录、兼容状态、注册/修复动作
