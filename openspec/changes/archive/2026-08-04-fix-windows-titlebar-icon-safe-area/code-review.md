# Code Review: fix-windows-titlebar-icon-safe-area

## Scope

- `scripts/build-icon-refine.py` — 小尺寸帧 12.5% 安全区生成与 tray-icon
- `src/lib/app-icon.js` — 内容寻址 Windows 图标物化
- `src/main.js` — BrowserWindow / jump-list / tray 图标路径
- `src/assets/icon.ico`、`src/assets/tray-icon.png`
- `tests/brand-icon-safe-area.test.js`、`tests/app-icon-cache.test.js`

## Review Checks

- [x] 改动限于品牌资源与主进程图标路径，未扩大 IPC 或渲染层范围
- [x] 构建时生成图标，运行时无额外 CPU/内存开销
- [x] 内容寻址路径避免删除可能被 shell 引用的旧文件
- [x] 自动化测试覆盖 alpha 边界与路径变化
- [x] lint 与 prebuild 签名验证通过

## Findings

- BLOCKING：无
- ADVISORY：userData 下可能累积历史 digest 文件，体积可忽略。

## Conclusion

Review PASS，可进入 QA 与 Story 门禁。
