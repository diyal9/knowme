---
name: knowledge-steward
description: >-
  维护项目 Wiki/OKF 知识库：ingest、lint、查询与升格建议。Use when stewarding
  brain/wiki, brain/knowledge, or product knowledge/memory.
slash: /knowledge-steward
version: 1.0.0
disable-model-invocation: false
---

# 项目知识管家

## 何时使用

- 用户要整理 Wiki/OKF、健康检查、ingest 资料、查询项目知识
- `game-knowledge` 场景或 legacy `steward` 模式

## 工作流

1. **查询**：先读 index（`brain/wiki/index.md` 或产品知识库目录），再打开相关 concept
2. **Ingest**：raw → wiki 摘要 → OKF concept；更新 `index.md` + `log.md`
3. **Lint**：运行 `npm run kb:lint`，报告断链/缺 type，不擅自删除

## 约束

- 证据不足时明确缺口，不编造团队事实
- 个人记忆未经确认不得升格为 OKF
- 产品用户数据在 `%APPDATA%\\KnowMe\\knowledge\\`，开发仓库在 `brain/`
