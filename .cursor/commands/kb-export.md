---
name: /kb-export
id: kb-export
category: Knowledge
description: 导出 OKF 知识库 bundle，供其他用户导入
---

导出 OKF knowledge bundle。读取 `okf-export` skill。

```bash
npm run kb:export
```

输出 `dist/kb-export/sticky-notes-knowledge-<date>/`，含 MANIFEST.json。  
导出前自动 lint（可用 `--skip-lint` 跳过）。
