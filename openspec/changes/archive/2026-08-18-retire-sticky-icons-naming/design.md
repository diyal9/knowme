## Context

`ui-icons.js` IIFE 注册全局图标表；`sticky-icons.ts` 薄封装 + React hook 在 DOM 更新后 mount。仅重命名，不改 SVG 或 mount 逻辑。

## Goals / Non-Goals

**Goals:**
- 全量替换 StickyIcons 遗产名为 KnowMe 中立名
- 保持 treeshake 侧效应配置（`ui-icons.js`）
- 新文件带文件头注释

**Non-Goals:**
- 改图标集、path 键名或 CSS
- 归档历史 OpenSpec 文档

## Decisions

1. 模块文件：`knowme-icons.ts`（与 `KnowMeIcons` 全局一致）
2. Hook：`useKnowMeIcons.ts` / `useKnowMeIcons`
3. 全局：`window.KnowMeIcons`（与 `ui-icons.js` 赋值同步）
4. 旧文件删除，不保留 re-export 别名（用户要求不留 sticky-icons 内容）

## Risks / Trade-offs

- 外部脚本若硬编码 `StickyIcons` 会断 → 本仓库内 grep 清零；legacy compare 脚本同步改

## Migration Plan

一次性替换 import 路径与符号名；无数据迁移。

## Open Questions

无
