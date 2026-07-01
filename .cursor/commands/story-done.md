---
name: /story-done
id: story-done
category: Team
description: Story 完成 — 门禁检查后归档 OpenSpec change
---

完成当前 Story。读取并遵循 `story-done` skill。

顺序验证：
1. 开发自测门禁
2. 制作人体验验收
3. 测试接入门禁
4. `/gate-check` 全项
5. `/opsx:archive` 归档

硬项失败 BLOCKING，不得归档。
