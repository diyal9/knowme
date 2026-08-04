---
name: okf-import
description: >-
  Use when importing an external OKF knowledge bundle into KnowMe,
  merging another team's learnings, or restoring from kb-export backup.
disable-model-invocation: true
---

# OKF 导入

## 命令

```bash
# 替换整个 brain/knowledge/（原目录备份到 brain/.knowledge-backup/）
npm run kb:import -- dist/kb-export/knowme-knowledge-2026-07-01

# 合并模式：冲突文件另存为 *-imported.md
npm run kb:import -- <path> --merge

npm run kb:import -- <path> --json
```

## 前置

- 来源必须是 OKF v0.1 conformant（`kb:lint` 通过）
- **制作人**批准大规模 replace

## 导入后

1. `npm run kb:lint`
2. 读 `brain/knowledge/log.md` 确认 import 记录
3. 必要时 `/kb-ingest` 同步 wiki 层

## 外部 bundle 要求

- 每个 concept 有 `type` frontmatter
- 含 `index.md` 推荐

参考：[OKF SPEC](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
