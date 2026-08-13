# Code Review: restore-unified-knowme-brand-icon

## Scope

- `assets/brand-src/knowme-icon.svg`
- `scripts/build-icon-refine.py`
- `scripts/prebuild.js`
- `src/assets/icon.png`
- `src/assets/icon.ico`
- `src/assets/tray-icon.png`
- `src/lib/app-icon.js`
- `src/main.js` 中的图标加载路径
- `tests/brand-icon-safe-area.test.js`
- `tests/app-icon-cache.test.js`

## Findings

- BLOCKING：无。
- ADVISORY：无。

## Review Notes

- SVG 与 Pillow 生成器使用同一组五节点坐标、线宽、节点半径和品牌色。
- 16/24/32/48/64/128/256 px ICO 帧均原生生成，不依赖 1024 px 主图二次缩放。
- Windows 托盘使用 32 px / 2× 表示，窗口 ICO 使用内容寻址路径避免旧缓存。
- 测试覆盖透明安全区、视觉占比、品牌色、五节点 SVG 结构、托盘尺寸和缓存刷新。
- 工作区存在其他活跃 change 的并行修改；本次评审仅覆盖上述图标相关范围。

## Conclusion

通过，可进入 Story 门禁。
