# Retro: restore-feishu-settings-one-click-auth

**日期**：2026-08-17

## 做对了什么

- 飞书卡片 CTA/文案抽成 `buildFeishuCardModel`，组件不内联就绪分支，后续改状态机只动纯函数。
- 用户主路径回到「一键授权」；全就绪禁用「已连接」，避免误导性「补充权限」。

## 可改进

- top-up stalled baseline 未完整迁回；若用户反复点补充无效，再开小 change。
- Story 收尾前应尽早写 acceptance/qa-plan，避免实现完再补软项。

## 是否升 OKF

暂不强制；本 retro 留在 `brain/memory/working/`。复发 ≥3 再 `/evolve`。
