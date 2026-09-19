# RQA107：条件路线生产就绪门禁

日期：2026-09-08

## 背景

生产能力审计此前只要必需 Skill、连接器和专家快照就绪，就可能输出 `productionReady=true`。这会把 manifest 中的 `requiredTools` 声明误当成真实工具回执，尤其会掩盖研究联网、飞书路由和生图工具尚未真正入场的问题。

## 变更

- `audit-production-capabilities.js` 将静态依赖结果命名为 `packageReady`。
- 增加 `executionReady`，要求所有带 `requiredTools` 的条件路线都已经取得 `readiness: verified`，且必需 Skill 已实际通过 grounding 检查。
- `productionReady` 现在同时要求 `packageReady` 和 `executionReady`。
- 未验证路线统一输出到 `unverifiedConditionalRoutes`，保留专家、路线、工具和 Skill，便于定位而不伪造成功。
- 任务运行时在每条执行证据中持久化实际 `executionRoute`；审计只接受当前路线下完整、成功的工具回执，不接受静态声明、部分工具成功或阻塞记录。
- 不改变可选连接器的非阻塞语义；没有条件路线的纯文本专家仍可在静态依赖齐备时通过包审计。

## 验证

- `tests/audit-production-capabilities.test.js`：9/9 通过。
- `tests/workbench-task-store.test.js`：14/14 通过。
- `npm test`：3501 项，3450 通过，0 失败，51 跳过。
- `npm run lint`：通过。
- `npm run test:renderer`：86 个文件、620 项通过。
- `npm run typecheck:renderer`：通过。

## 当前结论

六个保留专家的静态包可以达到 `packageReady=true`，但这不等于生产资格。当前已识别 7 条条件路线，包含办公协作、研究联网和生图专家的 `pango-generate`；当前用户数据中 7 条路线均无可复用的真实执行证据，因此仍需要在真实 Provider/连接器环境中取得工具回执并完成独立专业评审，在此之前完整审计不得输出 `productionReady=true`。
