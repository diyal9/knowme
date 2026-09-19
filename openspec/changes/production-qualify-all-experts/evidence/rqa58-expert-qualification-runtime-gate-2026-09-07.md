# RQA58：专家资格进入列表、详情与执行门禁

## 结论

此前 RQA57 已把外部仓库的断链引用、包外执行入口、未声明 MCP/网络合同记录为 `metadata.knowme.qualification`，但该事实只存在于安装记录和 sidecar：能力中心不展示，任务执行也不读取。因此界面仍把 `installed/enabled` 呈现成可工作的专家，已知不完整的专家仍可建立运行快照。

本轮补齐同一份通用资格契约的消费链路，不增加任何专家 ID 分支：

- 能力列表 DTO 透传 `qualification.state/issues/limitedSkills/assessedAtImport`，安装状态保持独立。
- 专家卡片与详情将明确的 `limited` 显示为“能力受限”，详情保留受限 Skill 与问题代码，供使用和调试。
- 能力中心不再为受限专家提供“打开/召唤后执行”入口。
- 服务端 `createSessionSnapshot` 对明确 `limited` 的专家返回 `expert_contract_limited`，不写运行快照；直接 IPC、旧入口或绕过 UI 也不能开始正式任务。
- 缺少资格字段的旧包保持兼容，不能把“未评估”擅自判成“不合格”；原有 binding readiness 的 persona-only 降级逻辑不变。

这只是已知合同缺陷的诚实门禁，不是专家专业资格认证。内置 22 位专家虽然均有 package-owned 专业复核合同，仍须真实模型任务、异常、反馈修改、重试与重开证据；th-art 的 5 位导入专家仍是 limited。

## 影响分析

- `mapCatalogItemToHub`：GitNexus CRITICAL，2 个直接依赖、7 条流程；d=1 为 `listCapabilities` 与测试调用。
- `createSessionSnapshot`：GitNexus CRITICAL，9 个直接依赖、5 条流程。
- `hubItemBadges`：LOW，2 个直接引用。
- 两个 React 回调在静态图中为 UNKNOWN；以源码引用和渲染回归补核。

## 回归证据

- 后端定向：22/22，通过；覆盖资格 DTO、明确 limited 拒绝快照、既有 snapshot 与 persona-only 降级。
- 能力中心：20/20，通过；覆盖受限标识、受限 Skill/问题代码及禁用执行入口。
- Renderer TypeScript：通过。
- 全量 `npm run check`：exit 0；后端 3560 项（3509 通过 / 51 跳过 / 0 失败），Renderer 86 个文件 607 项通过，lint 与 Renderer TypeScript 通过。

## 尚未完成

- 未获得外部 `D:/aiworkspace/th-art` 写入授权，未修其 11 个 limited Skill 与 5 个 limited Expert。
- 未新增任何一位专家的真实专业任务资格；24 位全集生产目标保持 ACTIVE。
