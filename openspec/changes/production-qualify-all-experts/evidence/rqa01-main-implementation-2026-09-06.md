# RQA01 通用调用重试与不确定结果隔离

日期：2026-09-06。状态：实施中，尚未通过本轮整仓门禁、独立最终复核或隔离真实 QA。不能据此认证 24 专家或声明供应商请求已物理停止。

## 诊断与反例

原始受控诊断使用真实 AgentRunExecutor 与真实 tool surface，模型和副作用为内存替身，不访问外部服务。network-after-effect、outer-timeout 两种场景各进入 handler 3 次；声明 240000ms 被外层改成 45000ms，超时结束时三个 handler 仍未响应。原始结果见 rqa01-retry-diagnostic-2026-09-06.json，脚本保持诊断时逻辑，不冒充修复后的绿测。

首轮限制明确只读重试、尊重契约超时、每次调用独立 abort 与可取消退避，初始7项通过；扩大到12项及原 executor/recovery 共57项通过，再加真实 surface 两种集成共14项通过。这里只覆盖外层和 surface，不是 registry 内层证明。

独立审查发现3个P1：内层deadline变成cancelled后继续同批操作；unknown/ECONNRESET信息丢失进入反思重发；明确超时码被文案中的参数词覆盖。详见 rqa01-independent-review-2026-09-06.md。主线新增9项红测，结果35 pass / 9 fail（rqa01-independent-red-2026-09-06.json）；不是只改提示词消掉报错。

## 当前主线修正

- getToolRecords 的真实 _knowme 契约控制 timeout；模型定义不暴露内部字段，模型 arguments 不能覆写控制信封。
- 自动退避重试只对 risk=read 且 sideEffects=false 开放。单有 idempotencySupported 不足以证明供应商能够去重在途请求。
- 未明确安全的失败调用，如果宿主没有证明 executionStarted=false，且调用前 validation 未拒绝，立即返回 operation_status_unknown；停止同批后续操作和模型反思，不从错误文本推断副作用尚未发生。
- 可信执行阶段由相邻 surface/registry 在宿主边界记录；任意 handler 自称未执行不能成为放行依据。该层正由独立协作者补齐，未用 mock 字段代替生产证明。
- canonical 错误码优先于自然语言，用于只读重试及错误呈现；它不再单独决定未知写入可重放。
- 父取消与每调用超时分开；外层先结算 timeout，再发出 invocation abort。退避可取消，迟到 Promise rejection 有消费路径。
- 不确定结果保留为 provide_input，标题为“需要核对操作结果”；不生成成功成果。任务层保留类型，先前排队输入与重启恢复不能跨越新暂停点；主输入框用于说明核对结果，页面不展示直接重试引导。

主线增加或调整：phases-model-tool.ts、tool-invocation-policy.ts、agent-run-executor.ts、agent-recovery.ts、agent-run-ports.ts（仅mock fixture回执支持）、shared/api.ts、domain/expert-input-need.ts及对应测试。原有错误纠正 fixture 显式标注执行前拒绝，未通过错误字符串自动伪造未执行事实。

主线第二轮本地回归：22项重试/真实registry边界 + 22项恢复策略 + 24项executor = 68/68，exit0。输入展示19/19通过。较早完整lint通过；相邻层仍在变化，以上不代替最后统一check。

## 影响分析与剩余边界

runModelToolLoop impact LOW，1直接调用方run、3条关联流程；classifyToolError HIGH，3直接/1间接；createMockRunPorts HIGH，2直接、总12影响，覆盖测试/eval脚本。已向用户说明共享风险。waitForInput及新helper/domain函数索引未找到，UNKNOWN；通过当前源码调用点与回归核对，不将0边解释为无人使用。整仓累积脏改动另行扫描，不宣称全部属于本次或已审完。

本轮仍待：registry取消来源及可信executionStarted整合、独立再审、完整check、原QA01真实retry和新图片端到端。终止等待/AbortSignal不是撤销已达远端的写入；未知结果需要目标端核对，不能自动宣称失败后安全重试。供应商级状态查询/幂等回执不能从布尔标签推定存在。

## 专业资格不混同工程通过

第三批独立评分：AO01冻结断言5/5，但附加责任安排、排序理由和未知变“无”需修订；RR01为2/5；QA01平台阻塞无正文，五项未评分且不进入专业分母。详见 professional-ao01-rr01-review-2026-09-06.md。冻结输出不修改，也不以静态SOP/安装Skill或工具完成事件认证专业能力。

## 后续整合与门禁（保留上文历史状态）

registry 与 surface 已完成宿主 executionStarted、错误码与取消来源整合；未知写入失败不再重放。独立复审关闭原3个P1，随后发现并关闭裸 surface 零预算仍入场的残余。最终 surface SHA256 为46cb19f42972b59dbcff10ef8fdf32a55f0f6d148ca5ffd64ab864abd17d620a。详见独立报告追加章节；162项复审与后续36项边界检查不相加冒充同一次测试。

首次整仓check32004 exit1，包括新增边界红测与旧fixture缺少明确工具/执行阶段契约；补齐真实只读声明或明确执行前拒绝，而非放松错误判断。最终check17946 exit0：后端2439项（2388通过、51既有跳过、0失败）、renderer80文件560项通过、lint及typecheck通过。整仓git diff --check exit0；GitNexus整树扫描为CRITICAL（302文件/561变化符号/160影响），含大量既有与并行改动，不能据此认领或认证整棵脏树。未提交、未覆盖用户工作。

已重启隔离QA Electron（非用户实例），对原QA01任务执行一次真实retry：新run expert_task-mtotfx67-mplj8_mtovv5f4，未改原材料/专家2.0.0包，空tool allowlist保持。本轮toolCalls为空，failed→review并产生完整answer，旧失败事件保留。详情见qa01-retry-live-2026-09-06.json。这里验证RQA11空权限下直接静态回答可用，不是对外部写入重试的真实服务验证。

界面在1280×820实测主输入框1个、接受成果入口1个、全文8条用例存在；初次截图按钮接近滚动底部，scrollIntoView后完整可见。刷新返回全局伙伴页，重新从工作台打开同任务后仍为输入框1/验收1/正文存在；不将路由重置误报成内容丢失。截图qa01-retry-review.png及qa01-retry-reopen.png均已人工查看。没有点击接受成果，专业资格尚不合格。

真实QA答复恢复不等于专业达标：新增过期键处理规则、未知自动化覆盖写成缺失、时序竞态覆盖不足，交独立评分。旧无正文基线仍N/A，新轮单独评分。新图片端到端、24专家全集/升级/发行/全面视觉验收仍未完成，目标继续。
