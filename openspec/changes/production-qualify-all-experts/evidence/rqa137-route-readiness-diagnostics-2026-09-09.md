# RQA137：通用专家专项路径就绪诊断

日期：2026-09-09

## 背景

生产能力审计已经能发现条件路线缺少 Skill，但能力中心只展示专家整体依赖，用户仍需等到真正开始任务时才知道某一条专项路径不可用。若直接把专项路径缺失提升为专家整体不可用，又会错误阻塞该专家的其它本地或已就绪能力。

## 修正

- 在通用 `CapabilityReadiness` 契约中增加可选 `routes` 诊断字段；每条路线包含路线标识、用户可读名称、必需 Skill/连接器和问题清单。
- `buildBindingReadiness` 统一从专家 manifest 的 `execution.routes` 读取路线依赖，缺失依赖生成结构化 `route_skill_unavailable` / `route_connector_unavailable` 问题。
- 路线诊断不改变专家整体 `ready/limited` 判定；仅当整体必需依赖缺失时才阻断专家新任务。
- 能力中心详情展示“执行路径”，明确区分“可用”和“缺少依赖”，并说明专项路径受限不影响其它路径。

## 验证

```text
node -r ./scripts/register-ts.js --test tests/expert-runtime.test.js
17 tests / 17 pass / 0 fail

npx vitest run --config vitest.config.ts src/renderer/features/capability-hub/capability-hub.spec.tsx
22 tests / 22 pass / 0 fail

npm run test:renderer
86 files / 630 tests pass / 0 fail

npm run typecheck:renderer
pass
```

真实用户数据只读审计仍为：

```text
packageReady=true
degradedExperts=0
executionReady=false
productionReady=false
conditionalMissing=4
unverifiedRoutes=7
```

这次修正确认了通用诊断和展示链路，但没有把缺少条件 Skill、未取得真实工具回执或未完成独立专业评审伪装成生产级通过。
