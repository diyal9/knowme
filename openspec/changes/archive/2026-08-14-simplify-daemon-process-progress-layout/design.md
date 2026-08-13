## Context

过程日志 Tab 已用 MarkdownLite 渲染 progress，并对 `ul > li` 套了卡片式网格；宽表放在窄栏 `md-table-wrap` 内横滑。见 proposal.md — Why。纯渲染层改动，无 IPC/主进程变更。

## Goals / Non-Goals

**Goals:**
- 去掉 tip、改标题、压扁列表卡片样式
- 「全部过程」标题栏提供整块摘要放大预览弹窗

**Non-Goals:**
- 不改 progress 源文、SSE、其它审阅 Tab
- 不为 Markdown 内嵌小节（如 Steps）单独挂放大入口

## Decisions

1. **tip 置空**：在 `projectProcessTranscript` 固定 `tip: ''`，UI 已有 `${process.tip ? ...}` 守卫，无需删 DOM 分支。
2. **标题常量**：`progress.title = '全部过程'`，同步契约测试。
3. **列表去卡片**：仅改 `.wb-daemon-progress-md ul > li` CSS 为 flex 单行，不改 Markdown 解析。
4. **全部过程放大**：在 `data-logs-block="progress"` 的 `.wb-daemon-review-logs-head` 右侧放 `data-progress-preview` 按钮（折叠 toggle 之外的独立控件）；点击后弹窗复用 `wb-modal-mask` / `wb-modal`，克隆整块 `.wb-daemon-progress-md`。无内容时隐藏按钮。

## Risks / Trade-offs

- [Risk] 重绘时丢失已打开弹窗 → Mitigation：弹窗挂在 `document.body`，与 logs 签名重绘解耦
- [Risk] 放大按钮误触折叠 → Mitigation：按钮在 toggle 外，独立 `data-progress-preview`

## Migration Plan

无需迁移。回滚：还原 tip/title/CSS/预览注入即可。
