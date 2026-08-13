## Why

打开「能力 → 专家」时，主目录卡片会出现两次入场刷新：主目录渲染后，辅助数据回调又整格重绘卡片；复用 iframe 再次打开时，resume 路径还会先刷绑定再 soft 拉目录，造成连续两次目录重绘。用户感知为「界面刷了两次」，削弱能力 Hub 的稳定感。

## What Changes

- 辅助数据（编辑器 catalog / composition / 工作台绑定）补齐后，只更新依赖它们的抽屉态，不再重绘精选区与目录网格。
- 复用打开（`capability-hub-resume`）时合并为单次轻量刷新：同步 Tab/深链后只刷新工作台绑定并更新抽屉，不再「先 renderGrid 再 soft loadCatalog」。
- 补充静态契约测试，锁定上述不重绘行为。

## 目标用户

在 KnowMe 工作台频繁打开能力 Hub 浏览/安装专家的创作者与研发用户。

## 验收标准

- 冷打开专家 Tab：主目录骨架 → 卡片仅入场一次；辅助数据到达后卡片不二次跳动。
- 关闭后再打开（iframe 复用）：目录不连续两次整格重绘；工作台绑定状态仍可在抽屉中更新。
- `npm test` / `npm run lint` 通过。

## 非目标（Non-goals）

- 不改主进程 catalog IPC 或缓存策略。
- 不移除卡片入场动画本身。
- 不预加载 Hub iframe。

## Capabilities

### New Capabilities

- `capability-hub-paint-stability`: 约束能力 Hub 主目录首屏与 resume 时的重绘次数，避免辅助数据/软刷新导致卡片二次入场。

### Modified Capabilities

- （无主规格 REQUIREMENTS 变更；行为补强落在新能力规格。）

## Impact

- `src/capability-hub.js`：`loadCatalogAuxiliaries`、`resumeFromHost`
- `tests/capability-hub.test.js`
- 用户可见：专家/技能/连接器目录打开更稳，无双重闪烁
