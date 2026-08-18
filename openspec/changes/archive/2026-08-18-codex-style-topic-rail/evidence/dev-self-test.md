# Dev self-test: codex-style-topic-rail

- Change: codex-style-topic-rail
- Date: 2026-08-18

## 改动摘要

- 左轨：目录短横线自上而下均匀排列（非 minimap 滑块）
- 去掉左侧粗视口条
- 右侧 3px 滚动条，仅 `is-scrolling` 时显示
- hover 预览卡片；点击跳到主题首条用户消息

## 验证

```bash
npx vitest run src/domain/wave9-parity.spec.ts src/renderer/features/assistant/assistant.spec.tsx
npm run lint
```

## 手动 Smoke

1. 助理多轮对话：左侧一列浅灰短横线，当前主题更深
2. 静止时右侧无滚动条；滚轮滚动时右侧出现极细条，停约 0.7s 后消失
3. hover 横线出卡片；点击跳到对应主题
