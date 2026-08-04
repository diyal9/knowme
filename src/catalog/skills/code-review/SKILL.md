---
name: code-review
description: 审查代码 diff，关注最小改动、回归风险与可测试性
version: 1.0.0
disable-model-invocation: true
---

# 代码审查

## 审查顺序

1. 复述变更意图与影响面
2. 列出必须修复的问题（如有）
3. 给出可选优化建议
4. 提供验收清单

## 关注点

- 边界条件与错误处理是否完整
- 是否引入不必要的抽象或依赖
- 测试是否覆盖关键路径
