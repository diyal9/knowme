# Proposal: formalize-skill-catalog-coverage

## 背景

技能审计发现：办公 Skill 长期挂在 `game-studio` 包下、`office-partner` 未默认启用导致 `writing-polish` 无法经 pack 加载；空状态缺「今日优先级」；官方工程/视觉工作流 skillRefs 悬空或依赖已卸载 Cursor 技能；`game-knowledge` 场景 `skillId: null`；`game-*` 缺 sidecar manifest。

## 目标

1. **P0** 启用并对齐 `office-partner`：办公/飞书 Skill 归属办公包；默认启用后 `writing-polish` 可 `loadSkillL1`；空状态含今日优先级（对齐 `office-assistant` spec）。
2. **P1** `code-review` 经 pack/catalog 可加载；`game-knowledge` 绑定 `knowledge-steward` Skill。
3. **P2** 为 `game-*` / `code-review` / `writing-polish` 补 sidecar；官方视觉工作流改绑 bundled `visual-brief-prompt`，不依赖已删 Cursor 技能。

## 范围

- `src/packs/*`、`src/catalog/*`、`src/lib/capability-pack-runtime.js`、`src/main.js`
- `src/lib/official-workflows.js`
- 相关测试与 `ensureDefaultPacks` 迁移

## 非目标

- 不回灌 Cursor 仓库 local-repo 技能
- 不改变便签核心 IPC

## 验收

- `game-studio` 与 `office-partner` 均默认启用
- 空状态含今日优先级；各悬空 skillRef 可 loadSkillL1
- `npm test` / `npm run lint` PASS
