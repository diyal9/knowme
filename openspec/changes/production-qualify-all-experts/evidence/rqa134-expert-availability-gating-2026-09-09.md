# RQA134：专家能力就绪门禁统一到新任务入口

日期：2026-09-09

## 发现

能力中心详情入口已经识别两类受限状态：能力合同未就绪（`qualification.state=limited`）和当前运行依赖未就绪（`readiness.state=limited`）。但任务首页的专家列表只检查生命周期与安装状态，可能仍把这类专家展示为可开始协作，直到创建会话或执行阶段才失败。

## 修正

`isExpertAvailableForNewTask` 现在统一检查：

- 专家是否允许创建新任务；
- 能力合同是否受限；
- 当前运行 Skill / Connector 依赖是否受限。

缺少资格或运行时评估的历史条目仍按兼容策略允许进入，避免把“未评估”误判为“失败”。受限专家仍保留在能力中心和历史任务中，用于修复与诊断，但不再出现在可运行的新任务入口。

## 验证

```text
npx vitest run src/domain/workbench-home.spec.ts
5 tests / 5 pass / 0 fail

npm run check
Backend: 3524 tests / 3473 pass / 51 skipped / 0 fail
Renderer: 86 files / 628 pass / 0 fail
lint / typecheck:renderer: pass
```

本次只修改通用能力类型、专家入口判定和对应回归测试，没有修改用户 `%APPDATA%/KnowMe` 数据。
