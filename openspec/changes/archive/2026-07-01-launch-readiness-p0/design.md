# Design: launch-readiness-p0

## 架构边界

| 模块 | 位置 | 职责 |
|------|------|------|
| `settings-secure.js` | `src/lib/` | 读写 settings.json，API Key 加密 |
| `notes-backup.js` | `src/lib/` | 便签目录 export/import |
| `auto-update.js` | `src/lib/` | 扩展手动检查更新 IPC |
| IPC | `main.js` | 删除确认、备份、app-info |
| UI | `settings.html` | 关于、备份、检查更新 |

## API Key 存储

- 使用 Electron `safeStorage.encryptString` / `decryptString`
- settings.json 存 `apiKeyEnc`（base64），不再存明文 `apiKey`
- 加载时兼容旧版明文并自动迁移加密

## 便签备份格式

```
sticky-notes-backup-YYYY-MM-DD/
  MANIFEST.json   { version, exported_at, note_count }
  notes/
    n_xxx.json
```

## prompt_space

- 生产启动不再自动导入
- `--dev` 模式下保留可选导入（开发者本地）
- 移除硬编码路径常量对普通用户的影响

## 删除确认

- 在 `ipcMain.on('note-delete')` 主进程弹 `dialog.showMessageBox`
- 统一覆盖工具栏删除、右键删除
