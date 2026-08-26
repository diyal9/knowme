# Test Report: establish-context-engine

- 日期：2026-08-26
- 角色：测试
- 环境：Windows · Node 24 · TypeScript/Vitest
- 结论：**SCOPE PASS / REPOSITORY GATE BLOCKED**

## 自动化结果

| 项 | 结果 |
|---|---|
| `npm test` | PASS — 1799 tests；1748 pass / 0 fail / 51 skipped |
| `npm run lint` | PASS — architecture / nocheck / lint / CSS cascade / script scope |
| `npx tsc --noEmit -p tsconfig.json` | PASS |
| `npx tsc --noEmit -p tsconfig.lib.json` | PASS |
| 相关 Renderer 测试 | PASS — Settings 7；原专家/会话相关组合回归继续通过 |
| Context Engine 针对性回归 | PASS — Context Engine 15 + Embedding Runtime 6 + Settings Secure 9 |
| `npx openspec validate establish-context-engine --strict` | PASS |
| `npm run check` | BLOCKED — Renderer 391 pass / 1 unrelated CSS contract fail |

## 唯一总门禁失败

`src/renderer/app/surface-css-contract.spec.ts` 检测到 `src/renderer/features/run/console.css` 含 `letter-spacing:-.01em`。该 CSS 文件在本任务开始前已有用户修改，且与 Context Engine 无依赖；为避免覆盖并行视觉方案，本任务未修改它。

## 覆盖要点

- 不可信上下文 authority 降级与注入边界
- identity 冲突 winner/suppression
- no-tools + Slash Skill fail-closed
- 空工具面不泄露四个知识内建工具
- capability prompt 渐进加载与字符预算
- optional 词面、confidence、freshness、vector fallback
- locale fallback
- manifest 内容/路径隐私
- off/shadow/active 模式隔离，shadow 不改变实际 topK
- active 只向 optional data block 提供向量分数，身份/权限/必选 block 不参与
- 独立 Host 不继承主模型 Key；独立 Embedding Key 经 safeStorage 加密
- sensitive 候选未授权时零远程请求
- 候选向量 LRU、single-flight、短超时、Abort、非法向量降级与三次失败熔断
- 动态段独立 block、system message 合并和后置研究 manifest 合并
- 多前导 system 消息保护与极小 token 截断硬上限
- 专家 Session persona/执行能力分离
- Renderer 原始用户输入与结构化 discussion context

## 性能证据

24 个候选 block、topK=6、总预算 2400 tokens 的本地同步装配，预热后执行 5000 次：总计 3445.51ms，平均 0.6891ms/次。该基准不调用网络或 embedding，符合默认关键路径。

24 个 optional block、topK=6 的异步语义预排序微基准：`off` 5000 次平均约 0.003ms；候选/query 向量预热并命中缓存后的 `active` 2000 次平均约 0.116ms，缓存内 25 个向量、无残留 in-flight。真实网络耗时受 Provider 影响，Context 请求由 1500ms 短超时和熔断约束。

## 真机建议（ADVISORY）

- 打开办公协作专家，询问“你有什么能力”，确认首句使用专家身份。
- 在规划阶段输入含 `/skill` 的问题，确认无工具时间线。
- 进入正式执行，确认所需连接器仍可调用。
- 查看日志中的 ContextManifest，确认无用户正文与本地路径。
- 在设置页使用用户自有 Provider 执行“测试 Embedding”，先以 Shadow 观察，再按需启用 Active。
