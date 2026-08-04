# 测试报告: game-studio-work-partner-daemon

## 摘要

| 项目 | 结果 |
|------|------|
| 单元/集成 | 906 PASS |
| Lint | PASS |
| Harness gate | PASS |
| UAT 静态预览 | PASS（3 截图） |
| Electron 真机 | PARTIAL（未在本轮启动；契约与 UI 代码已落地） |
| 飞书真实 OAuth | NOT VERIFIED |

## 用例

1. **策划结构化需求案** — PASS（game-requirement.test.js）
2. **飞书审批路径** — PARTIAL（artifact meta + 既有 IPC；无 live token）
3. **需求交接 Workbench** — PASS（handoff online/offline）
4. **Daemon 诚实状态** — PASS（assessDaemonReadiness + 截图）
5. **四类场景 + legacy** — PASS（game-studio-scenes + prompt-router）
6. **反模式 offline** — PASS（blocked + recovery）
7. **左 Rail** — PASS（uat-preview + workspace.html 未删 rail）

## 截图

- `evidence/screenshots/game-studio-empty-scenes.png`
- `evidence/screenshots/daemon-offline-blocked.png`
- `evidence/screenshots/daemon-ready-handoff.png`

## Word 报告

`evidence/KnowMe-手机游戏研发工作伙伴-UAT测试报告.docx`
