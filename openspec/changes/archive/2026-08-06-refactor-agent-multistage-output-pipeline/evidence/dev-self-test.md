# 开发自测报告

- 日期：2026-08-06
- Change：`refactor-agent-multistage-output-pipeline`
- Preflight：PASS（`needs_fix=false`）
- 定向回归：PASS（B1-B7 及复审负例）
- `npm test`：PASS（1271/1271）
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- OpenSpec strict validate：PASS
- Electron IPC 冒烟：PASS（`mode=electron`、18/18 IPC、`ipcPathVerified=true`）
- Harness gate：PASS（硬项全部通过）
- 应用启动：PASS（KnowMe 主进程正常启动，无 uncaught error；仅有开发态 Electron CSP warning）

## 手动与受控冒烟

- [x] 工具轮只展示执行阶段与安全摘要，不把临时 prose 写入回答区。
- [x] canonical answer 只经 `answer.committed` 提交，invoke 不提供第二正文来源。
- [x] suggestion、thinking/reasoning、非法与半截协议文本不会进入用户可见正文。
- [x] 正文与 structured UI 容器从 v2 消息挂载起保持同一 DOM 节点。
- [x] 用户上滑后 10 次事件的滚动漂移为 0 px。
- [x] pending review 在 terminal 后保持可见、可操作。
- [x] 已有 KnowMe 实例运行时，fixture 仍使用独立 userData 完成真实 Electron IPC 验证。

## 定量结果

- 正文回滚：0 次
- raw JSON 可见时长：0 ms
- duplicate/late 导致的 DOM 更新：0 次
- terminal：1 次
- IPC：18/18 成功
- scroll drift：0 px

## 证据

- `evidence/agent-output-electron-smoke.json`
- `evidence/screenshots/running-progress.png`
- `evidence/screenshots/canonical-choice.png`
- `evidence/screenshots/terminal-pending-review.png`
- `code-review.md`：最终复审 PASS / APPROVED
