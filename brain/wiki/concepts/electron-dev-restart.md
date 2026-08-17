---
type: Concept
title: Electron 开发重启与热更
description: 日常重启即再跑 npm start；不为看 UI 先编 dist。
tags: [electron, process, hmr]
timestamp: 2026-08-16T13:46:00Z
---

# Electron 开发重启与热更

KnowMe 桌面端日常开发：

- **重启** = 再跑一次 `npm start`（清残留 + Vite `:5173` + Electron `--dev`）
- 改界面保存即可热更新，**不要**为看 UI 先 `renderer:build`
- 清场用 `npm run kill`；Git Bash 不要手搓 `taskkill /F`
- 核对发行包才 `renderer:build` + `npm run start:dist`

完整 Playbook：[Electron Dev Restart And HMR](../../knowledge/processes/electron-dev-restart.md)

Skill：`team-learned-dev-electron-runloop`
