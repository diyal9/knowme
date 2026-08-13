## Why

技能卡片目前共用同一套抽象图标，域辨识弱；用户也缺少把常用技能钉住并快速筛选的入口。按工作域给代表图标，并支持星标收藏，可提升浏览与回访效率。

## What Changes

- 技能（及无头像的能力卡）按工作域使用代表性图标：写作 / 游戏 / 研发 / 办公等
- 卡片右上角增加收藏星标，点击切换收藏；本地持久化
- 分类筛选增加「收藏」chip
- 连接器 Tab 仍保留飞书等平台筛选；收藏对专家/技能/连接器通用

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `capability-hub`: 域图标映射、收藏星标与「收藏」筛选

## Impact

- `src/ui-icons.js`、`src/capability-hub.js`、`src/capability-hub.css`
- `src/lib/capability-store.js`、`src/lib/capability-hub-service.js`、`src/preload.js`
- 测试与自测证据

## 目标用户

在能力 Hub 浏览技能并希望快速找回常用能力的桌面用户。

## 验收标准

1. 技能卡按写作/游戏/研发/办公等域显示不同代表图标（非一律 sparkle）
2. 卡片有星标，点击后收藏/取消，重启后仍在
3. 筛选 chip 含「收藏」，点选仅显示已收藏项
4. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不为每个 skill 单独设计插画/品牌图
- 不做云端同步收藏
- 不改专家预设头像体系
