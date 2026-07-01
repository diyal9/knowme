---
name: /kb-lint
id: kb-lint
category: Knowledge
description: OKF 知识库健康检查 — schema、断链、孤儿页
---

运行 OKF lint：

```bash
npm run kb:lint
npm run kb:lint -- --json
```

检查：frontmatter.type、推荐字段、断链、孤儿 concept。  
输出修复建议，**不自动删除**文件。
