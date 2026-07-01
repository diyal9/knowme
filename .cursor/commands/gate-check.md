---
name: /gate-check
id: gate-check
category: Team
description: 执行 Story 完成门禁（test / lint / qa-plan / code-review）
---

执行 Story 完成门禁检查。读取并遵循 `gate-check` skill。

**门禁名称**：Story 完成门禁  
**触发时机**：/story-done 前 / 阶段切换前 / git commit 前

硬项 BLOCKING：`npm test`、`npm run lint`  
软项 ADVISORY：qa-plan（Smoke Scope）、code-review

输出检查表与结论。
