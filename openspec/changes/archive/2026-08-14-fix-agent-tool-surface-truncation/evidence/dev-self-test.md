# Dev Self-Test — fix-agent-tool-surface-truncation

日期：2026-08-11

## 改动摘要

1. **工具面投影预算**：`normalizeExtraDefinitions` 默认预算 64；必需工具 / 连接器工具优先于编排子 Run 工具；超限 warn 落盘，不再静默截断。
2. **失败可观测**：v2 助手气泡在无正文时展示 main 返回的可执行错误（通用兜底仅作最后手段）。
3. **Run 终态**：前置失败经 `settleAdoptedRun` 收敛；成功路径显式 `status/terminal=completed`，并回传 `text`。

## 自测

| 项 | 结果 |
|----|------|
| `npm test` | 1623/1623 pass |
| `npm run lint` | ok |
| Electron 冒烟 `evidence/doc-kb-electron-smoke.js` | pass（见 `doc-kb-electron-smoke.json`） |

## 冒烟要点

- 不再报 `所需工具不可用：feishu.doc_kb_suggest`
- 实际调用 `feishu.doc_kb_suggest`，返回个人文件夹等分区
- Run 状态 `done` / terminal

## 复现命令

```bash
node openspec/changes/fix-agent-tool-surface-truncation/evidence/doc-kb-electron-smoke.js
```
