---
type: Playbook
title: Electron Dev Restart And HMR
description: 日常开发重启即再跑 npm start；热更已是默认基建，不为看 UI 先编 dist。
tags: [process, electron, npm-start, hmr, sticky-memory, promotion]
timestamp: 2026-08-16T13:46:00Z
resource: sticky-agent-memory:pat_8530a8e8
---

# Electron 开发重启与热更

来源：本地会话记忆 pattern `pat_8530a8e8`（「重启」，升库时 ≥91 次），用户确认写入 OKF（2026-08-16）。  
口令执行细节见 Skill `team-learned-dev-electron-runloop`；本页是团队事实口径，避免每次临场再解释。

## 口径

重启和热更已经是默认基建。日常再跑一次 `npm start` 就是重启，不必先编译，也不必手搓杀进程。

开发热更会话：Vite `:5173` + Electron `--dev`。改界面保存即可看效果。

| 要做的 | 命令 |
|--------|------|
| 开发 / 重启体验 | `npm start`（先清旧进程，再起 Vite 热更） |
| 只清场 | `npm run kill` |
| 核对发行包观感 | `npm run renderer:build` 再 `npm run start:dist` |
| 打安装包 | `npm run build:win` 等（那时才编渲染产物） |

## MUST / MUST NOT

- **MUST**：口令「重启」= 再跑 `npm start`（内部已 `kill-knowme`）。
- **MUST NOT**：为看 UI 先 `renderer:build`。
- **MUST NOT**：在 Git Bash 手搓 `taskkill /F`（`/F` 会被当成路径）。清场用 `npm run kill` 或直接再 `npm start`。
- 启动前用 Node `execFile` 杀 `KnowMe.exe` / `electron.exe` 和占用 **5173** 的进程。
- 仓库若是 junction（`knowme` → `sticky-notes`），脚本会切到真实路径，避免 Vite 预构建崩溃。
- 关窗口后 `npm start` 以 **0** 退出；不要把停掉 Vite 的信号当成失败。
- `renderer:build` 只留给出包或核对 `dist`。

## 相关

- Skill：`team-learned-dev-electron-runloop`
- 口头指令：[Dev Collaboration Verbal Cues](dev-collaboration-verbal-cues.md)
- 登记：[Team Skills](team-skills.md)
- 仓库总纲：`AGENTS.md`「本地运行」
- Wiki：[Electron 开发重启与热更](../../wiki/concepts/electron-dev-restart.md)
