---
type: Reference
title: Open Knowledge Format (OKF) v0.1
description: Vendor-neutral markdown + YAML frontmatter knowledge bundle spec.
tags: [reference, okf, google]
timestamp: 2026-07-01T00:00:00Z
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
---

# Conformance

1. 每个 concept `.md` 必须有 YAML frontmatter
2. frontmatter 必填 `type`
3. `index.md` / `log.md` 为保留文件名

# Bundle layout

```
bundle/
├── index.md
├── log.md
├── concepts/
├── decisions/
└── references/
```

# Import/Export

本仓库：`npm run kb:export` → `dist/kb-export/`；`npm run kb:import <path>`。

# Citations

[1] [OKF SPEC.md](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
