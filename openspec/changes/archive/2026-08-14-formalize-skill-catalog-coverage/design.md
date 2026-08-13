# Design: formalize-skill-catalog-coverage

## Pack 归属

| Skill 域 | Pack | 说明 |
|---------|------|------|
| 飞书连接器任务、办公文档写作 | `office-partner` | 从 `game-studio` 迁出 |
| 游戏策划/研发/QA/制作、code-review、knowledge-steward | `game-studio` | 保留游戏垂直 |

## 默认启用

`ensureDefaultPacks()` 在首次启动（store 无条目）时 `installPack`：
- `game-studio`
- `office-partner`

已有 `game-studio` 且未显式禁用 `office-partner` 的用户：补装 `office-partner`。

## 路径对齐

`main.js` 与 pack runtime 对 `trustedCatalogRoot` 使用 `fs.realpathSync`，避免 `knowme`/`sticky-notes` 分叉触发 `catalog_outside_boundary`。

## 新增 bundled Skill

- `knowledge-steward`：Wiki/OKF 维护，挂 `game-knowledge` 场景
- `visual-brief-prompt`：Brief→文案方向→图像提示词，供官方视觉工作流

## 视觉工作流

`official-visual-brief-review.skillRefs` → `[writing-polish, visual-brief-prompt]`

## Sidecar

为 `game-*`、`code-review`、`writing-polish` 补 `capability.manifest.json`（schema v2 + experience.tasks 入口）。
