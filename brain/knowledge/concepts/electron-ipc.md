---
type: Playbook
title: Electron IPC Security
description: IPC boundaries and preload conventions for StickyNotes.
tags: [electron, ipc, security, architecture]
timestamp: 2026-07-01T00:00:00Z
---

# Rules

1. Renderer: **no** `nodeIntegration`
2. All privileged APIs via `contextBridge` in `src/preload.js`
3. No `eval()`, no `debugger` in production paths

# Verification

```bash
npm test    # smoke includes preload check
npm run lint
```

# Related

- Wiki: [Electron 架构](../../wiki/concepts/electron-architecture.md)
- Rule: `.cursor/rules/electron-src.mdc`
