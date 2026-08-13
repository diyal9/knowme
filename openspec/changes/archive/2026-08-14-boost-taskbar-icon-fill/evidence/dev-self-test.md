# 开发自测: boost-taskbar-icon-fill

## Change
`boost-taskbar-icon-fill`（修订：恢复原设计，仅放大填满）

## 做了什么
- **撤回**珊瑚红底 redesign
- 恢复深蓝 `#172535` + 米白路径 + 珊瑚起点
- 连接图约 1.42× 放大，线宽/节点加粗，透明边 42→24
- 重生 icon.png / icon.ico / tray-icon.png

## 证据
- `evidence/taskbar-scaled-fill-board.png`
- `evidence/icon-1024.png`

## 命令
```bash
python scripts/build-icon-refine.py --ship
node --test tests/brand-icon-safe-area.test.js tests/app-icon-cache.test.js
```

## 真机注意
完全退出并重启 KnowMe 后任务栏才会换新 ICO；红色缓存图会消失。
