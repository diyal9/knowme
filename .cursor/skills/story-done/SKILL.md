---
name: story-done
description: >-
  Story 完成：跑门禁、归档 OpenSpec change。触发词：/story-done、story done、
  完成 story。
---

# Story 完成（/story-done）

## 前置条件（顺序）

1. ✅ 开发自测门禁 PASS（`evidence/dev-self-test.md`）
2. ✅ 制作人验收 PASS（`acceptance.md` 签字）
3. ✅ 测试接入门禁 PASS（`evidence/test-report.md`）

## 步骤

### 1. 跑门禁

执行 `gate-check` skill 全部检查项。

硬项失败 → **停止**，不得归档。

### 2. 软项处理

qa-plan / code-review 缺失 → ADVISORY 警告，询问用户是否仍归档。

### 3. 归档

```bash
openspec archive --change "<name>"
# 或
/opsx:archive
```

### 4. 输出完成摘要

### 5. 知识沉淀（软项 ADVISORY）

建议写入 `brain/memory/working/<change>-retro.md` 并 `/kb-ingest` 升格至 OKF。  
复发问题记录到 `brain/memory/issues/` 供 `/evolve` 检测。

```markdown
## Story Done: <change-name>

### 门禁证据
- 开发自测：evidence/dev-self-test.md
- 制作人验收：acceptance.md
- 测试报告：evidence/test-report.md
- 截图：evidence/screenshots/

### Gate Check
<gate-check 结果表>

### 归档
Change 已归档至 openspec/changes/archive/
```

## 禁止

- 跳过制作人验收或测试直接 story-done
- 硬门禁失败仍归档
