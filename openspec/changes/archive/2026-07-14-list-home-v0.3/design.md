# Design: list-home-v0.3

## Layout

```
[侧栏 ~120px] [主区]
全部 / 收藏
── 主题 ──
category… (count)
未分类
```

- 侧栏点击设置 `themeFilter`，与搜索/排序叠加
- 列表行：星标 | 标题+版本 | 标签 chips | 时间 · 1 行预览

## Data

- 主题键：`note.category.trim()`；空 → `_uncat`
- 标签：`(okfTags || tags || []).slice(0, 3)`
- 无破坏性 schema 变更

## Window

`listWin` 默认约 `560×600`，`minWidth` 480。
