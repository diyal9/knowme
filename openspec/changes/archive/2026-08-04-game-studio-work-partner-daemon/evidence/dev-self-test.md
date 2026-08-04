# 开发自测: game-studio-work-partner-daemon (follow-up)

## 环境

- Branch: `feature/game-studio-work-partner`
- Workbench: `http://127.0.0.1:8010`（`D:/workflows/workbench`）
- Token: 自 `.nine/.workflow-config.yaml` admin key（E2E 自动解析）

## 命令

```bash
node scripts/sync-workbench-workflows.js
node scripts/daemon-live-e2e.js
npm test
npm run lint
npm run harness:gate
node scripts/generate-game-studio-uat-docx.js
```

## 结果

| 检查 | 结果 |
|------|------|
| sync-workbench-workflows | PASS |
| daemon-live-e2e | **PASS**（success exit 0 / fail script exit 1） |
| npm test | 916/916 |
| lint | PASS |
| harness gate | PASS |

## 关键观察

- `game-dev-delivery` 从 handoff intent 写入 `ingest/brief.md`，脚本生成交付包
- 成功路径无需 GitLab / CURSOR_API_KEY
- 失败路径：Daemon 任务 parked（returncode 2），脚本报告 exit 1，含可读原因与 resume 命令
