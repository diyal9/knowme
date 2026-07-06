# Windows 发布冒烟 — release-v0.1.1

**构建来源：** 本地 `dist-release/`  
**执行人：** 开发（`node scripts/release-smoke.js dist-release`）  
**日期：** 2026-07-02  
**结果：** **11/11 PASS**

| # | 步骤 | 结果 | 备注 |
|---|------|------|------|
| 1 | 产物 setup + portable + win-unpacked | ✅ | |
| 2 | SHA256 与 `SHA256SUMS.txt` 一致 | ✅ | 4 entries |
| 3 | 打包版本 `app.asar` = 0.1.1 | ✅ | @electron/asar 读取 |
| 4 | NSIS 静默安装 + 启动 | ✅ | `/S /D=...` |
| 5 | 首启自动建便签 | ✅ | 隔离 `--user-data-dir` |
| 6 | 内容写入磁盘（模拟自动保存） | ✅ | |
| 7 | 重启后内容恢复 | ✅ | kill → relaunch |
| 8 | 便签备份 exportBundle | ✅ | MANIFEST + notes/ |
| 9 | 删除便签确认对话框接线 | ✅ | main.js showMessageBoxSync |
| 10 | 检查更新 IPC/返回 message | ✅ | auto-update.js（UI Toast 待 QA 点按） |
| 11 | win-unpacked 进程启动 | ✅ | 含于 note-flow |

## 未覆盖（移交 QA / 制作人）

- 设置页**手动点击**「检查更新」Toast 文案（需已发布 GitHub Release 或断网场景）
- 删除便签** UI 点按**取消/确认（代码路径已验证）
- GitHub Release 页面资产与 notes 一致性（待 `git tag v0.1.1` 推送后）

## SHA256 摘要

```
StickyNotes-0.1.1-setup-win-x64.exe
4c6ff1344088116f06ff52888d80738477d8b5685aa246cf37a3bf67e30bbc4b

StickyNotes-0.1.1-portable-win-x64.exe
dd4f7a2f40d1f510b49eb09dfd49fa06bed28ca19e265127734820c6fee2b43b
```

复现：`node scripts/release-smoke.js dist-release`
