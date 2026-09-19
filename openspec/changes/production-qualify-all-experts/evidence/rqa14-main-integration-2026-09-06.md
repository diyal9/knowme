# RQA14：完整答复门禁与专家方法装配复核

2026-09-06。本轮为实质进展，不是等待或阻塞；24专家生产资格目标仍进行中。此次只改通用运行时两个文件，不加入专家ID特例、不更新用户安装、不修改冻结题或旧评分。

## 已修复并验证

- MODEL在工具参数校验和整批执行之前检查provider的length/max_tokens；不完整批次不执行，保留此前材料/成功操作并说明暂停原因。不按标点推断截断，兼容没有finishReason的旧端口。
- 正文截断只做一次禁用工具的完整重写，不续拼半句话、不重放已成功工具。只对这次修复按原outputTokens的两倍提供空间，受maxOutput限制；不增加输入预算，不改变正常stop或其他FINALIZE的2400额度。
- 所有FINALIZE调用点处理不完整及取消：正文修复、整批工具超过预算、轮次预算、GROUND、artifact_ready。第二次截断不得DONE/verified或提交半成品。真实产物已满足契约时可用确定性说明降级，后续完整契约校验仍有效；取消不能被降级摘要覆盖。
- metrics记录MODEL/FINALIZE结束原因，并累计FINALIZE实际usage，便于区分明确截断和仅凭文字猜测。

独立反例：初始12项2过10失败；修复后12过。第二位评审发现pre-tool over-cap分支遗漏终态处理，4条新增反例复现，已修；预算反例又发现800预算被2400下限扩大超过两倍，亦修。冻结测试不放宽，最终三个文件35/35通过。

最终源码完整`npm run check`（session27881）exit0：test、lint、renderer80文件560项、typecheck均通过。后端明细被输出尾部筛选省略，不推测数量。先前30749是中间源码的通过记录，不代替最终门禁。git diff --check为0（另有无关Windows GPU文件换行提示）。GitNexus整树扫描305文件/570符号/160受影响、CRITICAL，包含共享既有改动，不代表本轮全部审完；此次finalizeResponse影响HIGH已预先提示，两个直接调用者均核对并测试。

源码SHA256：model-tool `6706778DFE5DDBC54D4693AAADE06E845B75950BEB98F1395ABA08B5348F62E7`；ground-persist `F26E2A7D2558AACB7D4F06B58BEC3DFDA8BEF74F272C986BEAE53BAED13A232C`。独立报告的864215旧hash/34过1失败是小预算修复前的历史证据，不能当最新结果。

## 真实运行证据

仅使用隔离KnowMe QA profile及真实Qwen3.8Flash，安装基线和冻结SE-N01/SA-N01材料保持不变。临时executor观察器先调用原函数、原样返回，只采集结果，不伪造模型或工具；已恢复并移除。未操作日常profile/CDP9222，未接受任何成果。

| 任务及run | 实际结束原因 | 结果 |
| --- | --- | --- |
| SE task-mtp0nuq2-oc9ib / mtp0nuwh | MODEL length → FINALIZE length；实际输出token合计5000 | failed；不完整正文未作为成果；保留输入和重试 |
| SA task-mtp0nv3k-2kfue / mtp0nv96 | MODEL stop；输出2583tokens | review，4315字符完整结束，0工具 |
| SE同任务retry / mtp0w7iu | MODEL tool_calls → MODEL length → FINALIZE stop；输出4608tokens | review，3842字符；仅内部update_plan一次，未重复执行 |

前两次在固定2400修复额度下运行；SE重试在2600→5200受控额度下运行。当时源码仍有小预算2400 floor，之后仅移除了这个floor；对该2600实际配置计算相同，但不能声称真实任务已重启加载最后一次小预算源码。最终源码边界由35项及全量check验证。原文/实际metrics/任务状态在rqa14-initial-live-2026-09-06.json、rqa14-retry-live-2026-09-06.json。旧批次没有真实finishReason，不能倒推它一定因token截断。

真实UI：失败时一个主输入框+重新执行，无伪文档；重试后一个主输入框+接受成果；刷新回工作台重开，同正文和验收入口仍存在。截图rqa14-incomplete-live.png、rqa14-retry-review.png、rqa14-retry-reopen.png。一次scrollIntoView因轮询重渲染节点脱离失败，重新定位后通过；不隐去该测试现象。失败摘要仍有重复、长交付名仍冗长，这不是全UI精修验收。

## 专业能力与方法装配

运行结束不等于专家专业达标。两份新正文已完成独立评审：SE-N01 3/5、SA-N01 3/5，均专业不合格。输入/原文/实际调用和冻结评分保存在`skill-evals/professional-batch4-workspace/post-runtime-fix`，静态查看器为同目录上层的post-runtime-review.html；这是同安装基线的重复/重试，不是Skill新旧对照或统计提升。

SE的代码在给定事务契约下基本正确，但失败时序未完整证明双请求成功，测试缺同键并发、精确故障注入及受控调度；明示无工具委托下仍调用update_plan并否认调用，触发冻结硬失败。可串行化也被说成物理执行不可穿插。主线初读曾质疑“提交前断连无副作用”，独立评审指出这里是已知提交前/后的受控场景，不是在说客户端可从同一超时区分状态；本报告不保留该项作为确定错误。

SA的两个基础授权机制与过期/重启/乱序处理有正确部分，但认为服务端轮换密钥会使离线旧密钥与密文无法解密，且用先前清理旧缓存作为未来回退安全依据；账号/工作区绑定及可测迁移仍不足。未观察到真实泄漏，不把静态设计错误包装成已发生安全事故。不能用完整结束或测试用例数量替代正确性判断。

另见rqa14-method-binding-diagnosis-2026-09-06.md：三专家进入运行前requiredSkills本就为空，不是已选中方法被本批runtime丢弃。依赖/绑定不等于本轮L1；多默认交付物也不会自动匹配自定义primary。当前源码五步SOP与实际旧安装/快照有差异，仅重装现有同版包仍不能补齐方法声明。下一步应分别补紧凑专业方法、实际消费的交付/路由声明及可追溯版本升级，验证最终装配内容；不要全量注入依赖、覆盖用户定制或伪称方法装配已证明专业效果。

仍未完成：所有24专家的专业资格/完整生命周期，专业硬伤修正与留出复验，通用方法必读完整性与受管升级，新的真实生图完整体验、发行与视觉验收。总体目标保持ACTIVE。
