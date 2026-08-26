# Code Review: establish-context-engine

## 结论

**通过（代码范围内无 BLOCKING）**。Context Engine 已成为主助手会话的统一上下文装配入口，仓库硬门禁全部通过；远程 active 发布仍以真实 Provider canary 为外部验收条件。

## 架构审查

| 项 | 结论 | 说明 |
|---|---|---|
| 单一事实源 | 通过 | 内置核心/工具/五类场景提示位于 locale registry；旧 API 仅为 facade |
| 权限隔离 | 通过 | 专家协作 no-tools fail-closed；未知 executionPolicy 默认拒绝工具 |
| 身份隔离 | 通过 | `personaExpertId` 只加载 persona，`expertId` 才绑定执行能力 |
| 信任边界 | 通过 | 不可信 block 无法提升为 platform/scene/persona，且只投影为 user 数据消息；警告标签不作为安全边界 |
| 渐进加载 | 通过 | tier、scene、phase、capability、topK、预算共同选择 |
| 消息稳定性 | 通过 | 稳定前缀优先；同类 block 合并；全部前导 system 消息受保护 |
| 可观测性 | 通过 | manifest 有 identity、policy、tokens、included/omitted/conflicts/rankings；进程内聚合 p95、降级率、缓存、熔断与安全不变量 |
| 隐私 | 通过 | logger 不记录 system/dynamic 正文；source ID 与内容均哈希化 |
| 兼容性 | 通过 | `buildSystemContent` / `assembleCorePrompt` 保留；旧默认 prompt 指纹迁移 |
| Embedding 隔离 | 通过 | 网络在异步预排序层；assembler 保持同步纯函数；知识检索与 Context 开关独立 |
| Provider 密钥安全 | 通过 | 继承/同源才复用主 Key；跨 Host 必须独立 safeStorage 密钥 |
| 关键预算 | 通过 | critical 控制块不可截断；块上限或总预算不足时双层 fail-closed |
| 资源与并发 | 通过 | 向量维度、请求、响应、缓存字节和 provider state 有界；waiter Abort 不取消共享调用 |

## 反模式结论

- 已消除：万能大 prompt、字符串层层拼接、prompt-only 权限、persona/权限耦合、Renderer/system 数据注入、always-on 工具协议、原文遥测、双重裁剪和关键规则静默截断。
- 已约束：本地/远程向量不是正确性依赖，安全和身份不参与语义选择；embedding 不可用时确定性降级。
- 保留但可接受：标题生成、连通探测等无会话 one-shot 任务仍使用独立最小固定契约；它们不读取会话 persona、记忆或工具面，不进入主 Context Engine。
- 未引入：新的本地 embedding 模型、常驻向量服务、数据库 prompt CMS 和远程热更新。这些会增加启动体积、内存、供应链与升级风险，目前收益不足。
- 已避免：每轮全量向量化、长时阻塞 Context、跨 Host 密钥转发、部分向量覆盖导致敏感候选被隐式降权、向量控制身份/权限、仅按条目数限制向量内存、共享取消风暴。

## 性能审查

- 核心 chat：521 字符 / 约 311 tokens；完整工具核心：1131 字符 / 约 611 tokens。
- 24 候选 block、optional topK=6、2400-token 预算：5000 次装配平均 0.6891ms/次。
- 相邻稳定 block 合并后，基准样例 8 个 included blocks 仅产生 2 条 provider messages。
- selector 词面扫描和语义文本均限长；Embedding 总输入 96000 字符、响应体 16 MiB、向量 8192 维，避免可选语义排序拖慢或撑爆关键路径。
- 24 个 optional block、topK=6 的本地预排序微基准：off 平均约 0.003ms；候选向量缓存命中后的 active 平均约 0.116ms。网络请求只发生在 active/shadow、候选超过 topK 且隐私条件满足时。

## 残余风险

1. 当前只有 `zh-CN` 实体语言包，国际化机制已就绪但尚无第二语言内容。
2. 模型是否始终采用专家自称仍建议真机抽查；代码已消除已知冲突源，但模型输出不能仅靠单测完全证明。
3. ContextManifest 当前用于日志与 stage context，尚未提供面向终端用户的可视化调试面板。
4. 当前环境无 OpenAI/DashScope 用户凭据，真实双 Provider canary 尚未执行；远程 active 发布前必须补齐。
5. 聚合 SLO 已具备阈值和 warming 状态，但阈值仍需用真实生产流量校准，避免把实验室延迟当作长期基线。
