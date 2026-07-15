# 开发自测 — note-minimize-to-tray

**日期**：2026-07-14  
**结果**：PASS

## 命令

```
npm test  → 72/72 pass
npm run lint → lint ok
```

## 实现核对

- [x] 顶栏 `btnMin` 使用 `minimize` 图标，调用 `minimizeToTray`
- [x] `minimizeNoteToTray` → 写 `lastClosedNoteId` + `hideAllWindows`（不弹总览）
- [x] `restoreAppWindows` 优先 `showNote(lastClosedNoteId)`
- [x] 永久删除仍在右键/总览；设置文案已更新
