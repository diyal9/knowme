# QA Plan — add-expert-preset-avatars

## Smoke Scope

- [ ] 专家会话身份区：`office-partner` 显示写作预设图
- [ ] 专家会话身份区：`game-studio-partner` 显示制作预设图
- [ ] 未知 avatar / 自建专家：显示 `other/partner` 或语义匹配图，不崩溃、不直出 emoji
- [ ] 包体：确认仅 8 张 256px PNG，无 1024 原图误入 `src/assets/avatars`

## Anti-patterns

- 一排卡片视觉过花 → 预设仅 8 张分类锚点，不扩工种图鉴
- 图片 404 → 检查相对路径 `assets/avatars/...` 相对 workspace 页面
