---
name: /preflight
id: preflight
category: Team
description: 运行 Agent Harness 会话前预检
---

运行 Agent Harness preflight：

```bash
node .cursor/scripts/harness.js preflight --json
```

输出 JSON 摘要：node/npm 版本、缺失文件、活跃 change、needs_fix。

若 needs_fix，列出修复步骤后再继续开发。
