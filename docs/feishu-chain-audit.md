# KnowMe 飞书链路审计与修复

日期：2026-09-10。范围：伙伴与办公专家的飞书授权、工具投影、路由、读取、证据、重试。代码检查与离线测试覆盖整条链路；真实外部验证覆盖登录态及相关聊天适配器，不等于对所有飞书资源逐一实测。

## 本次故障

任务 `task-mtv8irda-9t1st` 要求读取飞书群聊/私聊消息。两次执行记录均为 `action-extraction`，工具调用和工具证据均为空；第二次却进入 `review`。此前正常用户环境的 `auth status --json --verify` 已确认 user 身份有效，并包含消息读取、搜索权限。

根因不是授权丢失：

1. `brief.materials` 混存了澄清记录、已确认计划、用户确认和业务正文。原 `hasReadableMaterials` 只判断非空，把计划当成已有业务材料。
2. 路由将目标和模型生成的步骤合并，按声明顺序取首个关键词命中。计划中的“行动项”命中了本地提取路由，该路由的工具白名单为空。
3. 本地路由没有必需飞书工具，预检与完成校验因此没有飞书读取义务。模型无工具可调用，生成了无依据的“未授权”说明。
4. 完成校验检查的是被选中的契约，不能从错误的本地契约恢复原来的外部读取目标；模型的复核通过不能证明读取发生。

## 分层职责与排查入口

| 层 | 实现 | 应核对的事实 |
| --- | --- | --- |
| 登录与授权 | `src/lib/connectors/feishu-auth.ts`、`feishu-auth-scopes.ts`、`feishu-status.ts` | KnowMe 使用本机 lark-cli 凭据；user 与 bot 分开；授权状态、实际 token 和业务 scope 不能混为一谈。受限进程可能读不到 Windows 凭据，不能据此直接让用户重新授权。 |
| CLI 适配 | `src/lib/connectors/feishu-cli/core.ts`、`scopes.ts` | 固定命令与参数、用户身份、超时、错误规范化、missing scopes；真实调用结果是当次读取是否成功的依据。 |
| 配置与工具投影 | `connectors/normalize.ts`、`runtime-config.ts`、`tool-runtime.ts` | 已安装、已启用、agentVisible、连接器 allowlist、任务 permissions 是不同条件。“配置了 9 项”不保证当前轮暴露全部工具。 |
| 伙伴入口 | `agent-generate-prepare.ts`、`feishu-grounding.ts` | 识别文档 URL、会议、消息等意图并补读取契约；专家执行使用独立契约，不能依赖伙伴的兜底修复专家路由。 |
| 专家入口 | `expert-execution-profile.ts`、办公专家两份 manifest | 从用户目标选择路由，计算 requiredTools、requiredConnectorIds、executionToolAllowlist、requiredEvidence。权限只可收窄，不能通过路由扩大包权限。 |
| 正式预检 | `expert-task-tool-preflight.ts` | 对必需连接器确认 user readiness 和真实工具投影；不可只相信包内的工具名称。 |
| 证据与终态 | `agent-execution-contract.ts`、`expert-task-runtime.ts` | 成功工具回执和来源证据必须满足契约；不接受模型自报 verified 替代工具记录。失败进入阻塞状态，不应产出待验收成果。 |
| 恢复 | `expert-task-runtime.ts`、`expert-task-approval-recovery.ts` | 保留任务与材料，重新计算当前契约。补 scope 后恢复应走应用的授权/重试入口，不手工改生产任务 JSON。 |

## 四类读取的实际边界

| 路由 | 工具 | 边界 |
| --- | --- | --- |
| 相关聊天 | `feishu.related_chats` | 指定自然日范围内的 @我 消息摘要，以及近期会话列表；不是所有私聊/群聊正文，也没有未读计数。分页和展示有上限。 |
| 会议 | `feishu.meeting_candidates` → `feishu.meeting_read` | 候选发现和选定后正文读取分开；会议卡片、标题不代表读到了妙记正文。 |
| 今日优先级 | `feishu.today_priority` | 日程、未完成任务、可选 @我 消息；实现保留各来源失败说明，部分来源成功不代表全部来源成功。 |
| 文档/知识库 | `feishu.doc_kb_suggest`、`feishu.read_doc` | 发现/推荐与正文读取不同；无数据且权限阻塞返回 missing_scope，部分检索错误保留在结果中。 |

外部写入继续使用草稿、明确审批和 apply 边界；此次没有发送消息、创建外部任务或修改飞书内容。

## 本次修改

- 公共材料分类排除宿主生成的三类控制记录，路由判断和用户材料证据快照使用同一规则。计划仍保留在任务上下文中。
- 目标匹配优先于执行步骤；关键词匹配按具体程度排序，避免宽泛“待办”抢走多项聊天语义。目标无匹配时保留旧任务的步骤提示恢复路径。
- 办公专家新旧 manifest 对“从飞书读取”的本地行动项路径添加排除条件，附带范围提示也不能跳过外部读取。
- 聊天结果不再吞掉会话列表错误；保留成功的 @我 消息，同时标记部分结果、分页限制、会话展示限制和未支持的数据字段。
- 工具描述在模型调用前声明上述读取范围，避免计划承诺全量私聊或未读统计。

## 验证与后续使用

- `tests/feishu-expert-chain.test.js` 覆盖四类路由 → 预检 → 工具与证据契约，拒绝零工具却自报成功，验证控制材料隔离、新旧配置一致、范围提示、会话列表失败与分页。
- 原截图任务只读重算：`action-extraction` → `related-chats`，必需工具为 `feishu.related_chats`。没有修改原任务、历史答复或生产凭据。
- 正常用户环境调用 KnowMe 自身的状态探测与聊天适配器：在线、userReady=true，读取成功，返回 3 条 @我 消息和 16 条会话展示项；日志仅输出状态和数量，未保存聊天正文。
- 完整检查使用 `npm run check`；结果见本次交付说明。真实读取验证不覆盖其他日期、资源 ACL、所有 provider 模型或所有自然语言表达。
- 本次修改包含主进程模块，运行中的旧进程需要重启才能加载；旧“等待验收”答复不会自动改写，需在任务内提出修订/重新执行，以新执行记录为准。

## 防止再次误诊

先查任务 `executionRoute`、`requiredTools` 和 `toolCalls`，再查正常用户环境下的 CLI 状态。没有真实权限错误时，不把模型的“无权限”当成授权诊断。空结果、部分结果、缺 scope、工具未暴露、连接器禁用、网络失败分别处理；禁止用再次全量授权代替路由排查。
