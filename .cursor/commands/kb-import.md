---
name: /kb-import
id: kb-import
category: Knowledge
description: 导入外部 OKF 知识库 bundle
---

导入外部 OKF bundle。读取 `okf-import` skill。

```bash
npm run kb:import -- <bundle-path>           # 替换（备份原 knowledge）
npm run kb:import -- <bundle-path> --merge   # 合并
```

来源须通过 OKF lint。大规模 replace 需制作人确认。
