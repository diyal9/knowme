# Retro: path-security junction + feishu-cli split

日期：2026-08-17

## 做了什么
- `isPathInsideRoot` 对 root/target 双 realpath，修复 Windows junction 误判
- `feishu-cli` 按域拆到 `feishu-cli/*`，清空 oversized 白名单
- 作废 `modularize-workbench-render-state`
- 归档 UI/规范/拆分相关 change

## 教训
内容源路径比较必须统一 realpath；仓库 junction 会让「父目录在 root 内」的直觉检查失败。
