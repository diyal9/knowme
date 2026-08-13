# Tasks: formalize-skill-catalog-coverage

## 1. Pack 重组与默认启用

- [x] 1.1 将办公/飞书 Skill 从 `game-studio` 迁至 `office-partner`（pack.json + scenes.json）
- [x] 1.2 更新 `game-studio` scenes：移除飞书空态场景；`game-knowledge` 绑定 `knowledge-steward`
- [x] 1.3 实现 `ensureDefaultPacks`：默认启用 `game-studio` + `office-partner`；main.js 启动调用
- [x] 1.3b Pack 启用时同步安装声明 Expert（`game-studio-partner` / `office-partner`）；已启用 Pack 启动时补装
- [x] 1.4 `trustedCatalogRoot` 使用 `realpathSync` 对齐路径

## 2. 新增/加厚 Skill

- [x] 2.1 新增 `knowledge-steward` Skill + catalog 条目
- [x] 2.2 新增 `visual-brief-prompt` Skill + catalog 条目
- [x] 2.3 为 `game-*`、`code-review`、`writing-polish` 补 `capability.manifest.json`
- [x] 2.4 `game-studio` pack 加入 `code-review`、`knowledge-steward`

## 3. 工作流与空状态

- [x] 3.1 `official-visual-brief-review` skillRefs 改绑 `visual-brief-prompt`
- [x] 3.2 `office-partner` 空状态场景含今日优先级（`feishu-today-priority`）

## 4. 测试与证据

- [x] 4.1 更新 pack/scene/office-catalog 相关测试
- [x] 4.2 新增 skill catalog coverage 冒烟测试
- [x] 4.3 `npm test` + `npm run lint` + dev-self-test.md
