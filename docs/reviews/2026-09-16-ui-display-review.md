# 界面显示一致性审查

日期：2026-09-16。范围：当前工作区，重点为专家协作、能力中心及其数据投影；辅助扫描伙伴、知识库、设置与工作流显示代码。结合一次 Bugbot 子代理审查、主代理复核和真实目录数据验证。仅审查，没有修改产品代码。

## 结论

确认 7 类问题：5 项 P2（应安排修复），2 项 P3（显示完整性与文案问题）。问题同时涉及名称缺失、数据字段丢失和错误状态回退，不能只补软件工程师的三个中文名字。

这是源码及数据逻辑审查，不是全应用桌面逐页验收。没有调用真实飞书授权，也没有验证全部分辨率和历史用户数据；未列出发现不代表其他页面完全无缺陷。

## Findings

### 1. [P2] 专家任务入口普遍回退到英文 ID

- 位置：`src/domain/expert-workbench-detail.ts:78`。
- 触发：首次进入带 execution.routes 的专家，尚未发送首条消息。
- 代码：名称只取固定 ROUTE_LABELS 映射或 label/name/id。内置路由只有 id、description，没有 label/name；固定映射仅覆盖办公专家四条旧路由。
- 真实配置验证：7 个专家声明 26 条路由，投影显示 25 条，其中 21 条 label 与 id 完全相同。软件开发工程师、产品经理、数据分析师、研究分析师、办公协作专家、舆情专家、Crawl4AI 专家均受影响。
- 同一数据在能力中心由 expert-runtime.ts 使用 description 作为名称，在工作台却显示 ID，形成跨页面不一致。
- 建议：为路由建立明确的用户显示名称，并统一投影。未知路由也应有可理解的回退；保留 ID 供执行与诊断使用。

### 2. [P2] 能力中心把已装配专家显示为“未装配”

- 位置：`src/lib/capability-hub/map.ts:263`；显示位置 `src/renderer/features/capability-hub/HubDetailDrawer.tsx:284`。
- 触发：从能力中心打开专家详情。
- mapCatalogItemToHub 没有输出 skills/connectors。lifecycle.listCapabilities 后续只补头像和 readiness，卡片打开详情时直接使用列表条目。
- 真实配置验证：软件工程师有 4 项技能；办公专家有 8 项技能及 feishu 连接器。经过映射，两者 skills/connectors 均为 undefined。
- 后果：技能显示“未装配；仅依据 persona 回答”，连接器显示“未装配；不会访问外部系统”，依赖安装建议也消失，与工作台的能力数量冲突。
- 修复还需检查跨类型依赖查询：专家列表按 kind 筛选，但详情在同一 hubItems 中寻找技能/连接器。仅补字段仍不足以恢复依赖安装操作。
- 建议：明确列表与详情数据契约，补全装配信息及跨类型依赖解析。

### 3. [P2] 权限面板丢弃权限值，允许和禁止显示相同

- 位置：`src/renderer/features/capability-hub/HubDetailDrawer.tsx:365`（165 行通过 Object.keys 提取）。
- 触发：打开专家详情中的“权限”。
- 软件工程师 network/write/externalWrite 为 false，工具与连接器白名单为空；办公专家 network 为 true，连接器含 feishu，工具白名单有 20 项。
- 两者显示完全相同的五个键：connectors、tools、network、write、externalWrite。
- 后果：用户无法区分关闭与开启、空权限与已声明权限，也看不到具体范围。
- 建议：按权限语义显示中文名称、允许/禁止及范围，同时区分包声明和本次任务实际授权。

### 4. [P2] 授权检测失败仍显示“已授权”

- 位置：`src/renderer/features/expert/ExpertTaskCapabilities.tsx:285`。
- 触发：飞书内联授权启动后，点击“我已完成，重新检测”，接口返回错误或连接器不存在。
- checkAuthorization 只排除 auth_required/userReady:false，没有检查 ok:false、错误状态或有效返回结构。
- 使用源码原始投影表达式验证：`{ok:false,state:'error'}` 和 `{ok:false,code:'not_found'}` 都得到“已授权”。代码随后还会清空授权 URL 和二维码。
- 建议：只有明确成功证据才能进入已授权；错误、缺失、未知状态应保留重试提示。首次状态加载与重新检测应使用同一状态解释逻辑。

### 5. [P2] 已确认交付退回显示“确认计划后锁定”

- 位置：`src/renderer/features/expert/ExpertTaskCapabilities.tsx:206`。
- 触发一：计划已确认，文件成果已提交但待验收。
- 触发二：纯文本 answer 已被接受，没有 artifactRef。
- 代码：存在 deliverables，但没有“已接受且有资源引用”的成果时，outputSource 直接变为空数组，不再显示 brief 中已确认的交付约定。
- 使用源码原始投影表达式验证，上述两种情况均显示“确认计划后锁定”。
- 建议：“本次委托”的交付约定与“成果物”的已验收文件列表分别投影。文件成果筛选条件不应抹掉已确认的委托内容。

### 6. [P3] 第九个专家任务入口被静默截断

- 位置：`src/domain/expert-workbench-detail.ts:84`。
- 触发：办公专家声明 9 条路由，routes() 最终执行 slice(0,8)。
- 真实投影验证：office-collaboration 从首屏快捷入口中消失，界面没有更多入口或截断提示。自然语言请求仍可使用该模式，因此并非执行能力被删除。
- 建议：区分完整路由与首屏推荐路由；如需限制首屏数量，提供“更多”入口或显式推荐规则。

### 7. [P3] 能力详情直接显示英文状态和风险枚举

- 位置：`src/renderer/features/capability-hub/HubDetailDrawer.tsx:213`、385 行。
- 触发：打开普通能力详情。
- 状态直接显示 enabled/disabled/available，风险直接显示 low，与同页顶部中文徽标不一致。
- 建议：统一状态、风险等级的中文展示函数，未知值显示“未知/待确认”；内部值放在诊断区域。

## 为什么现有检查没有拦住

1. 路由测试仅覆盖已写入映射表的 meeting-summary 和无路由两种情况，没有遍历真实专家目录。
2. 列表条目和详情共用宽泛数据结构，装配字段丢失会被“未装配”兜底隐藏。
3. 权限、授权、交付各自写显示条件，未知/错误和空字段被当成有效业务状态。
4. 现有侧栏测试检查已验收成果列表，但没有同时检查委托摘要在待验收及文本交付时的语义。

## 已执行验证

- 调用真实 parseExpertWorkbenchDetail 遍历内置专家 manifest：26 条声明、25 条显示、21 条英文 ID、1 条截断。
- Bugbot 使用真实专家配置调用 mapCatalogItemToHub，确认装配字段丢失及权限键相同。
- 从当前 ExpertTaskCapabilities 源码抽取原始显示表达式，在 Node VM 中核对交付与授权错误分支；没有替换产品逻辑。
- 执行：`npx vitest run --config vitest.config.ts src/domain/expert-workbench-detail.spec.ts src/domain/expert-present.spec.ts src/renderer/features/expert/expert-task-access.spec.tsx`。
- 结果：3 个测试文件，20 项测试全部通过。这只说明现有断言通过，不能视为上述问题不存在。

## 建议修复与回归顺序

1. 优先修正错误事实：装配字段、权限值、授权状态、已确认交付摘要。
2. 统一名称及枚举展示，覆盖所有内置专家和未知/第三方条目；解决路由截断。
3. 增加真实目录到界面的契约测试，以及失败、未知、待验收、文本交付、缺失名称和多路由的回归场景。
4. 对首次打开、能力详情、授权返回、交付验收几个关键场景进行桌面验收，再运行完整质量门禁。
