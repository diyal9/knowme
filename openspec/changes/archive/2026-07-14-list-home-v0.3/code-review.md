# Code Review: list-home-v0.3

**日期**: 2026-07-14  
**结论**: **通过**（无 BLOCKING）

## 范围

总览重构：主题侧栏、行内核心标签、紧凑布局、窗口加宽、版本 0.3.0。

## 审查要点

| 项 | 结果 | 说明 |
|----|------|------|
| 主题键 | OK | `category.trim()`；空 → `_uncat`；收藏独立 `fav` |
| 标签优先级 | OK | `okfTags` 优先，回退 `tags`，最多 3 个 |
| XSS | OK | `esc()` 覆盖 name/tag/category/title |
| 筛选叠加 | OK | theme × search × tagFilter × sort |
| IPC | OK | 仍用既有 `focusNote` / `initList`，无新通道 |
| 窗口尺寸 | OK | 560×600，min 480×420；定位右上偏移适配加宽 |
| 回归 | OK | 收藏/最多复制保留；收藏从侧栏进入不重复顶栏按钮 |

## 建议（非阻塞）

- 侧栏主题很多时仅纵向滚动，后续可考虑折叠「更多」
- 「未打标」可后续加一键跳转 AI 分类（非本版）

## 签字

- 审查：开发自审 + 自动化 `list-home.test.js`
- 日期：2026-07-14
