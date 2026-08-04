# connector-feishu-auth Specification

## Purpose

定义飞书连接器在对话内的授权提示边界与一键授权续跑体验，避免误报未授权并支持聊天内完成授权后自动续跑。
## Requirements
### Requirement: 授权提示只在真未授权时出现

系统 MUST 仅在飞书连接器确实未授权时输出授权提示；已有上文事实或已授权时不得误导用户去设置页授权。

#### Scenario: 基于上文事实的二次分析

- **WHEN** 上一轮已通过 `feishu.related_chats` / `feishu.today_priority` / `feishu.doc_kb_suggest` 取回事实
- **AND** 用户本轮提问是对这些事实的二次加工（统计、排序、关键词、Top N 等），本轮未再调飞书工具
- **THEN** 系统不得输出「我还没有拿到飞书工具返回结果」或任何要求去「设置 → 连接器」授权的文案
- **AND** 允许助手直接基于上文事实作答，仍不得编造上文没有的事实

#### Scenario: 授权正常但本轮未取数

- **WHEN** 飞书连接器状态为已授权（`state !== 'auth_required'` 且 `userReady !== false`）
- **THEN** 任何 grounding 提示都不得声称未授权，也不得引导用户去设置页授权
- **AND** 若确实缺少事实，提示应指向「让我先调用对应飞书工具」而非授权

#### Scenario: 真未授权

- **WHEN** 飞书连接器状态为 `auth_required` 或 `userReady === false`
- **THEN** 提示必须说明需要完成飞书 user 授权
- **AND** 提示必须携带可渲染为按钮的授权动作标记，供渲染层显示「一键授权飞书」

### Requirement: 聊天内一键授权并自动续跑

系统 MUST 在聊天气泡内提供一键授权入口，并在授权成功后自动续跑原提问。

#### Scenario: 聊天气泡内拉起授权

- **WHEN** 助手消息含授权动作标记
- **THEN** 该消息内渲染一个「一键授权飞书」按钮，而不是只给一句「请去设置」
- **AND** 点击后调用 `connectorsFeishuAuthStart`，在消息内联展示授权二维码与验证链接
- **AND** 拉起失败时展示真实失败原因，不得静默无反馈

#### Scenario: 授权完成后自动续跑

- **WHEN** 用户完成扫码授权，`connectorsStatus('feishu')` 变为已授权
- **THEN** 系统自动重发触发该提示的原始提问，无需用户重新输入
- **AND** 时间线出现对应的飞书工具调用
- **AND** 授权在超时时限内未完成时给出可重试入口，不得无限等待

### Requirement: Just-in-time incremental authorization for missing Feishu scopes

当飞书工具因缺少特定 scope 失败时，系统 MUST 基于 lark-cli 权威 `missing_scopes` 在对话内提供即需即授入口，并在授权后自动续跑原始提问；MUST NOT 泛化成"检查不到工具"或要求整体重新全量授权。

#### Scenario: Missing scope detected from tool failure

- **GIVEN** 飞书连接器已启用且 user 已授权
- **AND** lark-cli 读工具返回结构化 `missing_scope` 错误（含 `missing_scopes` 或 `required scope(s):` 文本）
- **WHEN** 系统构造失败提示
- **THEN** MUST 提取精确的缺失 scope 列表（结构化字段优先，文本回退）
- **AND** MUST 用友好能力名（如「知识库检索」）说明缺什么
- **AND** MUST 在 CTA 链接编码这些 scope（`knowme://feishu/auth?scopes=<encoded>`）
- **AND** MUST NOT 泛化为"检查不到工具/权限不足"的无指向提示

#### Scenario: One-click incremental authorization

- **GIVEN** 对话内显示了即需即授卡片
- **WHEN** 用户点击"补齐授权并继续"
- **THEN** 系统 MUST 只申请缺失的那几个 scope（增量授权）
- **AND** 卡片 MUST 提供可展开的原始 scope 明细

#### Scenario: Auto-resume after authorization

- **GIVEN** 用户完成增量授权
- **WHEN** 授权成功回到应用
- **THEN** 系统 MUST 自动续跑用户的原始提问，无需用户重新发起

#### Scenario: Unauthorized read without parseable scopes

- **GIVEN** 飞书读工具返回 401/403/unauthorized，但 lark-cli 未回传结构化 scope
- **WHEN** 系统构造失败提示
- **THEN** MUST 提供通用"重新授权"入口
- **AND** MUST NOT 落到"会议/妙记读取失败"等错配措辞
- **AND** MUST NOT 编造文档正文

#### Scenario: Do not misclassify non-scope failures

- **GIVEN** 失败原因是"文档不存在"或"妙记无查看权限（ACL）"
- **WHEN** 系统构造失败提示
- **THEN** MUST 保留各自的专属提示（核对链接 / 申请妙记权限）
- **AND** MUST NOT 转成缺 scope 的增量授权 CTA

### Requirement: Feishu tool unavailability is explained precisely

系统 MUST 在飞书相关请求失败或未执行前，明确区分连接器未启用、未授权、allowlist 未放行和未读取正文证据四种状态。

#### Scenario: Connector disabled

- **GIVEN** 飞书连接器 `enabled !== true`
- **WHEN** 用户请求读取或润色飞书文档
- **THEN** 提示 MUST 指向“设置 -> 连接器 -> 启用飞书”
- **AND** MUST NOT 误写成“没有工具返回结果”

#### Scenario: User auth missing

- **GIVEN** 飞书连接器已启用但 `userReady === false`
- **WHEN** 用户请求读取或润色飞书文档
- **THEN** 提示 MUST 指向完成 user 授权
- **AND** MUST NOT 混淆为 allowlist 或正文证据问题

#### Scenario: Allowlist missing

- **GIVEN** 飞书连接器已启用且已授权
- **AND** 当前所需工具不在 allowlist
- **WHEN** 用户请求对应飞书能力
- **THEN** 提示 MUST 明确指出需要放行的工具名
- **AND** MUST NOT 指向重新授权

#### Scenario: Body evidence missing

- **GIVEN** 飞书工具已可用
- **AND** 当前轮次只有链接或搜索结果，还没有通过 `feishu.read_doc` / `feishu.get_wiki_node` 读取正文
- **WHEN** 用户要求总结、润色或改写正文
- **THEN** 系统 MUST 先继续读取正文
- **AND** 对用户说明当前缺的是正文证据，不是连接器或授权问题

### Requirement: Transient Feishu API failures stay human-readable

系统 MUST 将飞书服务端瞬时故障（如 `Internal error` / `Please retry` / `code: 1`）呈现为可读中文提示，不得把原始 JSON、`log_id` 或堆栈直接展示给用户。

#### Scenario: Internal error after retries

- **GIVEN** 飞书读工具或会议工作流调用返回服务端瞬时错误
- **WHEN** 自动重试仍失败，或模型未生成正文时由失败提示兜底
- **THEN** 用户可见文案 MUST 说明接口暂时故障并建议稍后重试
- **AND** MUST NOT 包含原始报错 JSON、`log_id` 或 `identity` 字段转储

### Requirement: 权限判定表与授权申请列表保持一致

系统 MUST 保证权限完成度判定（`FEISHU_PERMISSION_PROFILE`）中每个能力类目，至少有一个 `requiredPrefix` 能被实际申请的 scope 列表（`FEISHU_AUTH_SCOPES`）覆盖；MUST NOT 用一个永远无法被满足的前缀参与 `permissions.complete` 计算。

#### Scenario: 判定前缀必须可被申请覆盖

- **GIVEN** 权限判定表声明某能力类目需要某组 scope 前缀
- **WHEN** 计算 `permissions.complete`
- **THEN** 该类目的前缀 MUST 至少有一个出现在授权申请的 scope 列表中
- **AND** 多维表格类目 MUST 使用飞书真实 scope 前缀（`bitable:app`），MUST NOT 使用 `base:`

#### Scenario: 判定要求的能力必须被真正申请

- **GIVEN** 判定表要求云盘、多维表格、日程能力
- **WHEN** 系统发起飞书授权
- **THEN** 申请列表 MUST 显式包含这三类能力的只读 scope
- **AND** MUST NOT 仅依赖 lark-cli `--recommend` 隐式补齐

### Requirement: 授权前的权限知情确认

系统 MUST 在拉起飞书授权页之前，向用户展示本次将申请的权限，并等待用户确认；MUST NOT 在用户点击后直接打开浏览器。

#### Scenario: 展示将申请的权限

- **GIVEN** 用户在设置页点击「一键授权」或「补充扩展权限」
- **WHEN** 系统准备发起授权
- **THEN** MUST 先展示确认面板，按能力名列出本次将申请的权限
- **AND** MUST 提供可展开的原始 scope 明细
- **AND** 补充权限场景下 MUST 标出当前尚缺的能力

#### Scenario: 用户取消确认

- **GIVEN** 确认面板已展示
- **WHEN** 用户点击取消
- **THEN** MUST NOT 发起授权、MUST NOT 打开浏览器
- **AND** 连接器卡片状态保持不变

### Requirement: 授权完成判定按权限缺口收敛

系统 MUST 以"权限缺口是否缩小"作为补充授权是否成功的判据；MUST NOT 因为发起前已满足的条件而判定本轮授权成功。

#### Scenario: 补充扩展权限场景下不得假成功

- **GIVEN** 用户已连接飞书且文档/知识库权限已就绪
- **AND** 用户点击「补充扩展权限」发起增量授权
- **WHEN** 用户尚未在飞书中确认授权
- **THEN** 系统 MUST NOT 提示「飞书授权成功」
- **AND** MUST NOT 自动收起授权面板

#### Scenario: 缺口缩小才算成功

- **GIVEN** 发起授权前已记录缺失能力集合
- **WHEN** 轮询发现缺失集合缩小或 `permissions.complete` 转为真
- **THEN** MUST 提示授权成功并刷新连接器卡片与权限摘要

#### Scenario: 缺口无变化时诚实反馈

- **GIVEN** 授权等待超时且缺失能力集合无变化
- **THEN** MUST 点名仍未开通的能力，并说明可能需要管理员审批
- **AND** MUST 将主操作降级为次要重试入口，MUST NOT 诱导用户无限重复同一操作

### Requirement: 工作流工具的权限缺口必须触发确定性授权入口

当飞书工作流类工具（如 `feishu.doc_kb_suggest`）的所有数据分区都因权限失败时，系统 MUST 以结构化 `missing_scope` 失败返回，使 grounding 层产出确定性的「补齐授权并继续」按钮；MUST NOT 返回成功而把权限缺口交给模型自由发挥成纯文本选项。

#### Scenario: 全分区权限失败

- **GIVEN** `feishu.doc_kb_suggest` 的云盘、知识库、检索分区全部因缺少 scope 失败
- **WHEN** 工具返回结果
- **THEN** MUST 返回 `ok: false` 且 `code: 'missing_scope'`
- **AND** MUST 聚合各分区的 `missing_scopes`
- **AND** grounding MUST 输出带 `knowme://feishu/auth?scopes=...` 的授权 CTA

#### Scenario: 授权后续跑被中断的任务

- **GIVEN** 对话中出现「补齐授权并继续」按钮
- **WHEN** 用户点击并完成授权
- **THEN** MUST 直接拉起增量授权，MUST NOT 只把选项文本当作新的用户消息发送
- **AND** 授权完成后 MUST 自动续跑触发该中断的原始提问

#### Scenario: 部分分区成功时不阻断

- **GIVEN** 部分分区取到数据、部分分区因权限失败
- **WHEN** 工具返回结果
- **THEN** MUST 保持成功返回并输出已取到的候选
- **AND** MUST 在正文中标注哪些分区因权限受限

### Requirement: 应用内授权深链不得走外部打开通道

`knowme://feishu/auth` 是应用内动作而非外部链接。系统 MUST 在渲染进程内消费该深链并执行「确认 → 拉起授权 → 等待 → 续跑」流程；MUST NOT 交给主进程 `open-external`（其协议白名单只放行 http/https/mailto/file，会返回「不允许的协议」）。

#### Scenario: 结构化建议触发授权

- **GIVEN** 模型以 `open_link` 结构化建议的形式给出 `knowme://feishu/auth`
- **WHEN** 用户点击该选项
- **THEN** MUST 直接在对话内拉起飞书授权，MUST NOT 提示「不允许的协议」
- **AND** MUST 在最近一条回复下方展示授权进度面板

#### Scenario: 内联 CTA 与结构化建议行为一致

- **GIVEN** 授权入口既可能是内联 CTA 按钮，也可能是结构化建议
- **WHEN** 任一入口被点击
- **THEN** 两者 MUST 复用同一套授权与续跑逻辑

### Requirement: 运行时发现的 scope 不得毒化整轮授权

飞书对设备授权请求整体校验 scope：只要其中一个名字非法，整轮请求失败。系统 MUST 过滤非 scope 形态的运行时发现值，并在飞书拒绝时降级为已验证的基础 scope 列表重试；MUST NOT 让一次失败的工具调用把用户的授权入口彻底堵死。

#### Scenario: 丢弃非法 scope 名

- **GIVEN** 工具错误里带回 `not a scope` 这类非 scope 形态的值
- **WHEN** 系统构建 `auth login` 命令
- **THEN** 该值 MUST NOT 出现在 `--scope` 参数中

#### Scenario: 飞书拒绝时降级重试

- **GIVEN** 运行时发现的 scope 形态合法但飞书不认（如 `knowledge:space:readonly`）
- **WHEN** 首次请求返回 `invalid or malformed scopes`
- **THEN** MUST 用基础 scope 列表重试并成功拿到授权链接
- **AND** MUST 向用户点名本轮未能申请的权限名，MUST NOT 假装已全部申请
