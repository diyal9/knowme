---
name: /kb-ingest
id: kb-ingest
category: Knowledge
description: 吸收原始资料，更新 wiki + OKF knowledge bundle
---

执行知识 **Ingest**。读取 `llm-wiki-maintenance` skill。

1. 确认来源（`brain/raw/ingest/` 或用户指定）
2. 更新 `brain/wiki/` 与 `brain/knowledge/` OKF concepts
3. 更新 `index.md` + `log.md`
4. 运行 `npm run kb:lint`

可选输入：文件路径或 change 名称（Story 回顾沉淀）。
