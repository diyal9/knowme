## Context

技能 Hub 卡片图标目前回退为 kind 级 `optimize`/`users`/`network`。收藏可复用便签星标交互（空心/实心），持久化放在 capabilities 用户目录，与 install-store 并列。

## Goals / Non-Goals

**Goals:**

- 工作域 → 代表图标映射（写作/游戏/研发/办公/默认）
- 星标收藏 +「收藏」chip + 本地持久化

**Non-Goals:**

- 每技能独立美术资源
- 云同步 / 多端合并

## Decisions

1. **图标**：复用 StickyIcons；新增 `gamepad`（游戏域）；写作=`pencilLine`，研发=`code`，办公=`clipboardCheck`，默认 skill=`optimize`，connector=`network`
2. **收藏键**：`kind:id`（如 `skill:writing-polish`），文件 `%APPDATA%/KnowMe/capabilities/favorites.json`
3. **Chip**：各 Tab 在「全部」后插入「收藏」；筛选时 `favorite === true`
4. **IPC**：`capability-favorite-list` / `capability-favorite-toggle`；`capability-list` 条目带 `favorite` 布尔
5. **交互**：星标 `stopPropagation`，不打开抽屉

## Risks / Trade-offs

- 未知分类回退默认图标，可接受
- IPC 通道数增加，需同步测试计数
