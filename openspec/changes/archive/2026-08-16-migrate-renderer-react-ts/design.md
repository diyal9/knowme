## Context

渲染层从巨型 HTML/JS 升级为 React/TS。产品行为不变。LegacyHost 已否决。

## Goals / Non-Goals

**Goals:** 唯一 React 渲染栈；typed API；feature 目录；Spec 红测驱动；默认 Vite。

**Non-Goals:** 主进程/IPC 重写；产品变更；LegacyHost。

## Decisions

1. React 19 + Vite + TS strict + Zustand。
2. 默认 `KNOWME_RENDERER=vite`；仅显式 `legacy` 才允许对照（开发期可删）。
3. UI = 组件 + store；规则在 `src/domain/`。
4. 构建 `dist/renderer/<entry>/`；不再 copy legacy html 进产物。
5. 测试：L0 node:test 保留 lib；L2 Vitest+RTL；L3 Playwright。

## Electron 边界

```text
main.js --preload--> window.api --> React renderer only
```

## Risks

| Risk | Mitigation |
|------|------------|
| 翻译成单文件 TSX | feature 拆分，单文件评审上限 |
| 字符串测试在删 html 后失败 | L0 暂保留 golden 文件供旧测；运行时不加载 |
| 聊天性能 | 消息列表窗口化 |
