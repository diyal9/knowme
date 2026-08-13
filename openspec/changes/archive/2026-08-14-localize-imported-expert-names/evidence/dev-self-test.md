# 开发自测 — localize-imported-expert-names

日期：2026-08-11

## 硬门禁

| 项 | 命令 | 结果 |
|---|---|---|
| 单测 | `npm test` | pass 1615 / fail 0（284 suites） |
| Lint | `npm run lint` | `lint ok` + `script-scope ok` |
| OpenSpec | `openspec validate localize-imported-expert-names --strict` | valid |

新增用例：`tests/expert-display-name.test.js`（推导链路、语言前缀剥离、长度上限、无中文回退）、
`tests/cursor-capability-repository.test.js`（导入写入中文名与 `originName`、用户改名重扫不覆盖）、
`tests/capability-integration.test.js`（回填幂等、精选专家不被覆盖、用户改名跳过回填）。

## 桌面冒烟（隔离用户数据）

`node openspec/changes/localize-imported-expert-names/evidence/expert-display-name-electron-smoke.js`
→ `expert-display-name-electron-smoke.json`：8/8 通过，渲染进程无错误。

| 检查 | 结果 |
|---|---|
| 卡片标题显示中文名 `ArtBundle 专家` | pass |
| 副标题降级展示原 slug `artbundle-expert` | pass |
| install-store 记录 `originName` + `nameSource=derived` | pass |
| 按原 slug 搜索命中 | pass |
| 详情抽屉显示「原始标识」 | pass |
| 编辑器改名后卡片更新为「我的打包专家」 | pass |
| 改名标记 `nameSource=user` 且保留 `originName` | pass |
| 渲染进程控制台无错误 | pass |

截图：`screenshots/experts-chinese-display-name.png`、`screenshots/expert-drawer-origin-identifier.png`、
`screenshots/expert-renamed-card.png`。

## 真机数据验证

`node openspec/changes/localize-imported-expert-names/evidence/real-data-hub-shot.js`（真实 `%APPDATA%\KnowMe`，
启动时自动回填）→ `screenshots/real-app-expert-cards.png`：

| id | 卡片标题 | 副标题原始标识 |
|---|---|---|
| `th-bi-b34eeabc8d` | 手游运营数据分析协作 | th-bi-analytics-assistant |
| `th-config-b5e2031ece` | RDPI 配置协作 | rdpi-config-assistant |
| `artbundle-expert` | ArtBundle 专家 | artbundle-expert |
| `ui-expert` | UI 专家 | ui-expert |
| `office-partner` / `game-studio-partner` | 办公伙伴 / 游戏工作室伙伴 | —（精选中文名未被回填覆盖） |

回填幂等：二次启动 `backfillExpertDisplayNames` 无新增改名（`hasChineseText` 命中即跳过）。

## 已知残留

导入自 Cursor 技能的专家描述仍保留 `中文：… English：…` 双语原文，本次仅处理展示名，未改描述。
