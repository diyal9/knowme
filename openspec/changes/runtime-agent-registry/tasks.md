## Specification and contract

- [x] 定义运行时 Agent Registry、专业 Definition、生命周期与 revision 语义
- [x] 增加专业定义归一化、质量门禁和完整 capability manifest 持久化
- [x] 增加 preview/commit 防陈旧协议与 revision/rollback 存储

## Runtime integration

- [x] 将 Registry 组合进 Capability Hub，并开放受控 IPC/API
- [x] 让现有能力中心创建专家复用完整定义与 qualification 失效规则
- [x] 在专家任务、试聊、快照和子 Agent Run 的主进程入口强制 lifecycle 门禁
- [x] 退役时清理工作台与工作流绑定，同时保留历史任务和包

## Capability governance

- [x] 增加 verify/preview/commit/list-revisions Agent 工具及审批合同
- [x] 增加通用能力治理 Skill，伙伴和能力管家均可复用
- [x] 增加工具标签、作用域和防陈旧/未确认错误处理
- [x] 增加 draft get/update 工具、IPC/API 与未发布草稿状态
- [x] 新增精选 `能力管家` 并声明 Agent/Skill 调优、测试、评估和生命周期边界
- [x] 将创建专家入口收敛为结构属性，保存后自动进入能力治理协作房
- [x] 冻结 `agent-operations` normal、edge、retry、revision、reopen 资格用例
- [x] 增加 DeepEval 风格评估集、真实 observation、分层指标、本地报告和配置 hash 门禁
- [x] 增加固定 Python DeepEval bridge、运行时检查及用户批准的隔离环境安装能力
- [x] 为能力管家绑定评估集保存、评估执行和报告读取工具，缺依赖或证据时 fail closed
- [x] 移除能力管家顶部 Agent 选择器，改为对话候选或输入框 `#` Agent Token 选择
- [x] 为已安装 Skill 增加列举、读取、静态校验和审批发布工具，保护内置及外部只读 Skill
- [x] “我的技能”新建入口改为对话式共创；“我的连接器”只管理已安装项且不提供创建入口

## Release and verification

- [x] 版本升级到 0.5.0，并同步运行时 client version 与版本测试
- [x] 补充 Registry、工具、IPC、生命周期和兼容性测试
- [x] 运行 `npm run check`、GitNexus 变更检测和 OpenSpec gate
- [x] 完成 code review、acceptance 与 test report
