# QA Plan — retire-sticky-icons-naming

## Smoke Scope

- 工作台各 Surface 图标正常（侧栏、Shelf、TaskHome、Run、Hub、Manage、Expert）
- 设置页入口图标 mount 无报错
- 文件树 TreeIcon、通用 Icon 组件渲染 svg
- `grep`：`src/` 无 StickyIcons / sticky-icons / useStickyIcons

## 反模式

- 仅改 TS 未改 `ui-icons.js` 全局 → 运行时 undefined
- 保留旧文件名或 re-export 别名 → 不合格
