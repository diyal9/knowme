# Design: footer-toolbar-compact

## 布局

```
[ 文本 | MD ]  [ 👁 ★ 🏷 ✦ ⏱ ]  ····· meta ·····  [ AI 助写 ] [ 复制 ]
   mode-seg         foot-tools                         foot-actions
```

## 渲染（`note.html`）

- `#modeMdPreview` 从 `.mode-seg` 移出，放入 `.foot-tools`，class 改为 `foot-tool`（保留 id）
- 收藏 / 入库 / 智能分类 / 历史 统一为 `foot-tool`；收藏仍用 `#btnStar.on` 控制实心星
- `.ai-toggle` / `.btn-copy-primary` 共用 `.foot-action` 基类，包在 `.foot-actions` 内
- JS：预览 `disabled` / `active`、收藏 `on`、复制 `copied` 逻辑不变，仅 class 名对齐

## 样式要点

- `.foot-tools`：`gap:1px`，钮 `26×26`，无描边边框，hover/active 用 accent 底
- `.foot-action`：高 28、字 11px、浅描边，与 mode-seg 同高；AI hover 走 accent，复制成功走 green
- `.footer` gap 略减（8→6），中间组更紧、左右呼吸感更好

## 主进程 / IPC

无变更。
