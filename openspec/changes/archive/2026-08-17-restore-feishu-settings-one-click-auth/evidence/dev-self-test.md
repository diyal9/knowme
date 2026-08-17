# 开发自测：restore-feishu-settings-one-click-auth

**日期**：2026-08-17  
**结果**：PASS

## 命令

```bash
npx vitest run src/renderer/features/settings/settings-feishu-card.spec.tsx src/renderer/features/settings/settings.spec.tsx
npm run typecheck:renderer
```

## 结果

- settings-feishu-card.spec.tsx：5 passed
- settings.spec.tsx：4 passed（含一键授权 → 已连接）
- typecheck:renderer：exit 0

## 改动摘要

- `buildFeishuCardModel` 封装状态 / CTA
- SettingsFeishuSection 消费 view-model
- 空列表文案与高级设置 caret
