---
name: okf-export
description: >-
  Use when exporting StickyNotes OKF knowledge bundle for other users,
  sharing team learnings, or creating a portable knowledge package.
disable-model-invocation: true
---

# OKF 导出

## 命令

```bash
npm run kb:export
npm run kb:export -- --json
npm run kb:export -- --out my-bundle-name
npm run kb:export -- --skip-lint   # 仅调试
```

## 输出

`dist/kb-export/sticky-notes-knowledge-<date>/`

含 `MANIFEST.json`（okf_version、导出时间、import 提示）。

## 分享方式

- Zip 整个目录
- Git submodule / 独立仓库
- 对方运行 `npm run kb:import -- <path>`

## 门禁

默认 export 前跑 `kb:lint`；error 则 BLOCKING。
