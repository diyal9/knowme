# RQA96 — Capability Hub runtime readiness

日期：2026-09-08

## 目标

修复通用 Agent 平台中的前置可用性误导：专家包已安装不等于当前环境具备其必需 Skill/连接器。用户应在能力中心就能看到不可执行原因，而不是进入专家房间后才看到空转、缺工具或失败消息。

## 实现

- `listCapabilities` 对已安装专家调用同一套 `buildBindingReadiness`，使用当前启用的 Skill 和连接器集合计算 readiness。
- `mapCatalogItemToHub` 以兼容方式透传规范化的 readiness DTO，不改变既有 qualification 合同。
- 能力卡片新增“当前不可执行”状态；详情抽屉展示缺少的 Skill/连接器及问题说明。
- 专家进入工作台前复用同一 readiness 门禁，缺少必需依赖时不再打开执行房间。
- 运行时新增 orphan expert 集成断言，确保缺失 Skill 会产生 `unavailable_skill`。

## 验证

```text
npm run test:renderer -- src/renderer/features/capability-hub/capability-hub.spec.tsx
1 file, 21 tests passed

node -r ./scripts/register-ts.js --test tests/capability-integration.test.js
23 tests passed

node -r ./scripts/register-ts.js --test tests/capability-integration.test.js tests/expert-runtime.test.js
37 tests passed

npm test
3485 tests, 3434 passed, 51 skipped, 0 failed

npm run typecheck:renderer
exit 0

npm run lint
exit 0; existing advisory line-count warnings only
```

## 结论

本轮通用运行时/能力中心门禁已落地并通过工程回归。远程 Provider 授权、缺少的真实连接器安装/授权，以及各专家的真实专业质量仍需外部环境和真实任务继续验收；不能以本 RQA 宣布专家生产资格完成。
