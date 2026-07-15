# Code Review: list-context-menu

**日期**: 2026-07-14  
**结论**: **通过**（无 BLOCKING）

## 范围

总览列表精简右键：`list.html` + `preload.js` + `main.js` 独立 IPC，不复用便签窗口菜单。

## 审查要点

| 项 | 结果 | 说明 |
|----|------|------|
| 菜单精简 | OK | 仅打开 / 收藏 / 条件展开版本 / 删除 |
| 与便签菜单隔离 | OK | 新通道 `show-list-context-menu`，未改 `show-context-menu` 模板 |
| 多版本条件 | OK | `groupSize > 1 && groupKey` 才插入「查看全部」 |
| 展开行为 | OK | `list-open-group` → `openProjectGroup`，与徽章同路径 |
| 删除确认 | OK | 列表场景双按钮；默认取消；写盘后 `init-list` |
| XSS | OK | `data-group-key` 经 `esc()`；菜单 label 来自主进程数字/已读字段 |
| preload 面 | OK | 仅暴露 `showListContextMenu` / `onListOpenGroup` |

## 建议（非阻塞）

- 收藏逻辑与 `note-toggle-favorite` 有小段重复，后续可抽 helper
- 折叠行删除只删最新一版，产品上可后续加「删除全部版本」（本版刻意不做）

## 签字

- 审查：开发自审 + `list-home.test.js` 冒烟
- 日期：2026-07-14
