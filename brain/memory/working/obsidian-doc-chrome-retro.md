# Retro: obsidian-doc-chrome

## 做对了什么
- 按 Obsidian 心智一次收敛头栏（阅读 + More）与底栏状态条，避免再叠一层工具栏。
- AI 入口迁到 ribbon 后，iframe 用 `toggle-ai` / `ai-state` 双向同步，状态不漂移。
- 单测锁定 HTML/JS 契约，门禁可脚本化验证。

## 下次改进
- 手工 Smoke 仍依赖结构断言；后续可用 Playwright 对 `editor-pane` iframe 做一条 E2E。
- `note.html` 与 `editor-pane` 底栏分叉需在遗产清理 Story 统一或标注长期废弃。

## Follow-up
- 无 BLOCKING follow-up。
