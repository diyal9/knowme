# 代码审查

使用 GitNexus impact/context 辅助追踪，主线程审查与独立只读 reviewer 复核。尝试指定 Bugbot 子代理失败（环境不支持该类型），改由通用独立 reviewer；不声称运行了 Bugbot。

## 已确认问题与处理

| 优先级 | 问题 | 修复方向与证据 |
|---|---|---|
| P1 | 飞书旧 contract 没有 connectorId，旧工具绕过撤销 | 统一 source/namespace 归属，catalog、执行、延后审批均复查 scope 与 connector enabled/allowlist；agent-feishu-scope-revalidation |
| P1 | 新普通工具操作审批在专家页面没有入口 | ExpertTaskAccess 区分 capability-access/tool-execution，展示安全目标/参数与批准拒绝；Renderer 和真实本地 IPC 集成 |
| P1 | 批准之后 approval_required checkpoint 仍卡住 | 精确绑定 draft/run/task，宿主操作回执与手动续跑；其他等待不被清除；expert-task-operation-approval |
| P2 | Skill scope 回调重算但仍捕获旧 session | 回调读取当前持久化 session，检查消失/任务切换/父级限制/脚本权限；skill-session-freshness |

## 主线程补充审查

- 空 Brain scopes 不再表示全量访问；整张查询子图、解释路径和证据都受项目隔离。
- 知识工具调用前后复核授权和项目，源/身份变化影响缓存键；指纹不暴露凭据。
- 移除“任一本地知识源即可拼入全局 index 与截断 Skill”的旧旁路。
- Skill 正文与激活契约作为受限数据，不提升为 system 指令；必要正文/资源放不下时阻塞。
- 结果不确定的写入转查证，不直接重试；认证、范围授权和操作批准分别提示。
- 旧工作记忆主题匹配不能作为归属授权；重复知识片段去重但保留不同来源与不同片段。

## 最后风险复核

连续审批问题已经修复并经独立 reviewer 关闭：宿主回执沿 recoveryRunId 读取祖先，同一任务 A→B→冷恢复保留两次证据；不包含无关 run，祖先缺失或循环 fail closed。主线程恢复集成 25/25 通过，独立 recovery-context 6/6 通过。

原始四项及连续审批这项均已关闭。冷 MCP 的宿主校验回调漏传问题也已修复，独立 reviewer 对回调、root preflight 与 500 冷连接器复测 5/5 通过；模型不可替换宿主校验，撤权后不能连接。主线程冷加载 22/22 通过，包含单连接器 500 项目录和 requiredTools 跨轮激活；已生成图片 FINALIZE 预算保留相关回归 32/32 通过。

后续全量发现的三项失败均已修复：两条旧连接器用例改为经公开加载入口验证会话关闭/实际执行，原有断言保留；旧 prepared snapshot 兼容路径增加诊断字段空值保护，不改变权限和 required 契约。MCP 三种传输共用完整分页模块，循环、超限、后页错误均不发布部分成功。主线程分页／连接器／RQA12 共 32/32 通过。全量门禁状态见测试报告，不能由局部 review 推断整仓绿灯。

本报告覆盖本专项，不代表整个已有脏工作区没有问题。真实外部连接器和桌面人工体验的未执行项单独记录，不以静态审查推断运行成功。

最终分页增量另经独立只读 reviewer 复验 13/13 通过；覆盖三种传输、游标原样传递、循环检测、后页失败清空及页数边界，限定范围未发现新的实质缺陷。
