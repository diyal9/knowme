# RQA136：生产能力审计的快照写入边界

日期：2026-09-09

## 发现

生产能力审计默认把专家会话快照写到 `%APPDATA%/KnowMe/capabilities/snapshots`。在受限环境或只读用户目录下，这会产生 `EPERM`，并把审计结果错误降级为“专家不可用”。这与审计“默认只读”的产品语义冲突，也会掩盖真正的 Skill、工具和执行回执问题。

## 修正

审计脚本现在遵循明确的写入边界：

- 未指定 `--snapshot-root` 时，在系统临时目录创建隔离快照目录；
- 指定 `--snapshot-root` 时，才将诊断快照持久化到调用方指定的位置；
- 用户 `%APPDATA%/KnowMe` 仍只作为被审计数据源，默认不会写入；
- 快照权限失败仍保留为可诊断的 `snapshot_failed`，不会被静默吞掉。

## 验证

```text
node --test tests/audit-production-capabilities.test.js
16 tests / 16 pass / 0 fail

默认真实审计：
packageReady=true
degradedExperts=0
executionReady=false
productionReady=false
conditionalMissing=4
unverifiedRoutes=7
```

结果说明审计环境误报已消除，剩余失败项是真实的条件 Skill 缺失和条件路线未取得执行回执，而不是快照目录权限问题。
