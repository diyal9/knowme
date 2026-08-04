# Delta Spec: connector-feishu-auth

## ADDED Requirements

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
