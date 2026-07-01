---
name: team-run
description: >-
  三角色 ReACT 自循环编排：制作人规划 → 开发实现 → 制作人验收 → 测试 QA。
  触发词：/team-run、团队协作、跑一轮、开始版本。
---

# 团队协作编排（ReACT）

按规划目标自行循环执行，直至 Story 完成或用户叫停。

## 输入

- 可选：change 名称、用户目标（如「v0.2 增加便签分组」）
- 无 change 时：制作人先 `/opsx:propose`

## 状态机

```
PLANNING (制作人)
    ↓ proposal/specs/tasks/qa-plan 就绪
DEVELOPING (开发)
    ↓ tasks 全勾选 + 开发自测门禁 PASS
PRODUCER_UAT (制作人验收)
    ↓ acceptance.md 签字通过
TESTING (测试)
    ↓ test-report 通过
DONE → /story-done
```

任一阶段 FAIL → Reflect → 回到责任角色修复 → 重新过该门禁。

## 执行步骤

### 1. Reason（全局）

```bash
openspec list --json
openspec status --change "<name>" --json
```

确认当前 change、schema、artifact 完成度。

### 2. 按状态 Act

| 状态 | 角色 | 动作 |
|------|------|------|
| 无 change / 规划不全 | 制作人 | `/opsx:propose` 或补全 qa-plan、acceptance |
| tasks 未完成 | 开发 | `/opsx:apply` |
| tasks 完成，无自测报告 | 开发 | 跑 test/lint，写 dev-self-test.md |
| 无制作人验收 | 制作人 | 走查 acceptance.md |
| 验收通过，无测试报告 | 测试 | 执行 qa-plan + 反模式 |
| 测试通过 | 全员 | `/story-done` |

### 3. Observe

每轮结束汇报：
- 当前阶段 / 角色
- 门禁 PASS/FAIL
- 证据路径
- 下一步

### 4. Reflect

- Bug / BLOCKING → 指派责任角色修复，**不跳过门禁**
- 用户叫停 → 保存状态，输出进度摘要

## 输出格式

```markdown
## Team Run — <change-name>

**阶段**：DEVELOPING  
**角色**：开发  
**ReACT**：Reason ✓ | Act … | Observe … | Reflect …

### 门禁
| 门禁 | 状态 |
|------|------|
| 开发自测 | PASS/FAIL |
| 制作人验收 | 待测 |
| 测试接入 | 待测 |
| Story 完成 | 待测 |

### 下一步
<具体动作>
```

## 约束

- 严格 OpenSpec：无 artifact 不开发
- 交互顺序：开发自测 → 制作人验收 → 测试 → story-done
- 危险命令需用户确认
- 同进程执行；端口占用可覆盖
