# Retro: fix-create-skill-drawer

## 做对了什么

- 快速定位根因：Electron 禁用 `window.prompt`，表现为「点击无反应」而非报错
- 复用现有知识库抽屉，避免再造一套表单

## 可改进

- 设置页交互勿用 `alert`/`confirm`/`prompt`；CI 可扫这三个 API

## 升格

- 暂不建 Skill；约定已写入 `openspec/specs/slash-skill/spec.md`
