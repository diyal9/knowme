# Tasks: feishu-scope-confirm-and-resume

## 1. 权限画像与申请 scope 对齐

- [x] 1.1 `FEISHU_PERMISSION_PROFILE.base` 判定前缀由 `base:` 改为 `bitable:app`
- [x] 1.2 `FEISHU_AUTH_SCOPES` 补入 `drive:drive:readonly`、`bitable:app:readonly`、`calendar:calendar:readonly`
- [x] 1.3 新增 `findUnrequestedPermissionCategories()`，返回"判定要求但从未申请"的类目
- [x] 1.4 新增 `planFeishuScopeRequest(permissions)`，产出本次将申请的能力名 + scope 明细，供确认框使用
- [x] 1.5 单测：一致性不变量（每个类目至少有一个 requiredPrefix 被申请列表覆盖）

## 2. 设置页：授权前二次确认

- [x] 2.1 新增确认面板 DOM（能力清单 + 可展开原始 scope + 确认/取消）
- [x] 2.2 `btnFeishuQuickAction` / `data-feishu-auth` / 重试入口统一先走确认
- [x] 2.3 取消时不发起授权、不改变卡片状态

## 3. 设置页：授权完成判定按缺口收敛

- [x] 3.1 发起授权前快照缺失能力集合，随授权流程保存为本轮目标
- [x] 3.2 `checkFeishuAuthStatus` 在补充权限模式下要求"缺口缩小或 complete 转真"才算成功
- [x] 3.3 超时且缺口无变化时输出点名文案 + 次要重试按钮，不弹成功 toast
- [x] 3.4 授权成功后刷新连接器卡片与权限摘要

## 4. 对话内权限中断走确定性 CTA

- [x] 4.1 `executeDocKbSuggest` 各分区收集结构化 `missing_scopes`（drive 列表 / wiki spaces / 搜索）
- [x] 4.2 全分区无数据且存在权限缺口时返回 `{ ok:false, code:'missing_scope', missingScopes }`
- [x] 4.3 有部分数据时保持成功返回，但在正文中标注权限受限分区
- [x] 4.4 单测：全权限失败 → missing_scope；部分成功 → 仍 ok

## 5. 对话内授权深链可用（回归修复）

- [x] 5.1 渲染进程拦截 `knowme://feishu/auth`，不再交给 `open-external`（会返回「不允许的协议」）
- [x] 5.2 抽出 `runFeishuAuthInChat`，内联 CTA 与结构化建议复用同一套授权+续跑逻辑
- [x] 5.3 结构化建议触发时把进度面板挂到最近一条回复下方（`ensureFeishuAuthHost`）
- [x] 5.4 `sanitizeExtraScopes` 过滤非 scope 形态值；阶梯降级到已验证基础列表
- [x] 5.5 授权面板点名本轮被丢弃/未申请的权限名
- [x] 5.6 单测：拦截顺序、降级阶梯、诚实文案

## 6. 门禁

- [x] 6.1 `npm test` 通过（758 tests / 130 suites 全绿）
- [x] 6.2 `npm run lint` 无 error
- [x] 6.3 写 evidence/dev-self-test.md
