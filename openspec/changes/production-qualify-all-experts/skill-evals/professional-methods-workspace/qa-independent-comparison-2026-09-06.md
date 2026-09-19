# QA 两题整包旧/新独立评分

2026-09-06。只读隔离 QA 采证，未调用真实 API、运行被测服务或改源码/方法/QA配置。按 skill-creator/agents/grader.md 逐项评分并检查断言外 claims；静态测试操作与预期不当作本人已经执行。

| 案例 | 旧包2.0.0 | 候选2.1.0 | 全文混合字数（旧→新） | 专业结论 |
| --- | --- | --- | --- | --- |
| QA01 | 1/5 | 3/5 | 618→754 | 两份均 hard fail |
| QA02 | 4/5 | 3/5 | 711→554 | 两份均 hard fail |

## 绑定与装配证据

- QA01旧：task-mtowd8zn-rcehl / wb-expert-task-mtowd8zn-rcehl / expert_task-mtowd8zn-rcehl_mtowd955。
- QA02旧：task-mtowf0eu-ia7vs / wb-expert-task-mtowf0eu-ia7vs / expert_task-mtowf0eu-ia7vs_mtowf0lv。
- QA01新：task-mtowze06-flgkn / wb-expert-task-mtowze06-flgkn / expert_task-mtowze06-flgkn_mtowzee3。
- QA02新：task-mtox1n0a-196qg / wb-expert-task-mtox1n0a-196qg / expert_task-mtox1n0a-196qg_mtox1ne6。

四份均review且有正文，无N/A项；平台review/verified不等于专业验收通过。task.execRef、session.taskRef、答复runId、artifact.meta、checkpoint.runId及同run日志均核对；冻结input和五条expectations与metadata一致。旧版requiredSkills/skillRefs均为空；候选为qa-test-design，两次skill.explicit-content均hash=7fd29382fb4eaf38、chars=1016、truncated=false。候选live.json保留完整task/session和同run contextAudit，transcript与answer直接绑定同run，没有按数组位置认领任务。

只读源：D:/UserCaches/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de，限定workbench-tasks.json、agent-sessions.json、相应run checkpoint及日志；未读settings/profile/secret。主线old_skill原始live/transcript/answer未改。

## 专业差异与不可放行点

- **QA01旧**：新设计与“日志部分佐证”混在执行状态栏，不判伪造本人执行，但不满足状态分列要求。管理员只有前置姓名，缺实际覆盖；24h边界只有笼统“计算准确”，取消完成竞态未设计。额外硬伤：“取消失败或仅标记状态”“无重复计费/资源消耗”都比R2/R3更强且无依据。
- **QA01新**：未执行与材料分析分开，成员/管理员基本覆盖改善。仍把距创建23:59:59的界内同键请求条件化为新ID；未明确跨界动作，不能用“端点待确认”消解R2冲突。固定4xx并非R3要求；唯一约束报错也不能单独替代任务计数/身份与回执核验。取消与完成仍是顺序描述，不是受控竞态。软删/归档和索引DDL可作标明条件的建议，不能直接升级为原需求或执行事实。
- **QA02旧**：确认前允许旧/新完整态、确认后ack再重启的设计成立；同基线并发只写“同时到达、按序处理”，控制不足。4/5不掩盖额外错误：冲突响应码未定不意味着V1不变量不可测，更不与E2“全绿”逻辑矛盾。自动合并用例标未定义/阻塞，不能只因关键词就判已实现或本人执行。
- **QA02新**：TC03给出有效的检查前暂停、B提交、释放A交错；TC04却在同base=6且A已持久化后仍要求B提交，允许rev=8，违反V1。TC01也未设旧内容非x，却要求重启读值非x；暂停在检查前并未验证版本比较拒绝。全部崩溃设计缺ack后持久化用例；E1他方样本不能替补新设计覆盖。TC02写集合后另有“禁混合”，不脱离上下文将其判成允许混合。

每份五条原文断言、证据和额外claims见对应grading.json。正确局部可通过对应断言，但错误的另一用例或建议理由仍可使整份hard fail；没有把合理风险建议本身当虚假事实。

## 计数与比较边界

全篇含标题、表格及附注，沿用既有口径：/\p{Script=Han}|[A-Za-z0-9]+(?:[.,/][A-Za-z0-9]+)*/gu。Han逐字、连续数字字母词块计一；raw及标点另报，不把Markdown长度当中文字数。四份均≤800；QA01最多8行（候选含1行材料核对），QA02均6条。句子压缩或分数变化不能覆盖错误预期。

这里只比较两道已披露回归题的四份整包配置输出（2.1.0 vs 2.0.0），包含SOP、依赖、输出ID/requiredSkills与实际L1装配变化，不宣称纯Skill因果。四份无专业总资格放行；不是盲留出、重复统计试验或专家生产认证。

## 本轮写入范围

iteration-1/QA01、QA02 下各新增 with_skill/{live.json,transcript.json,outputs/answer.md,grading.json}；old_skill 仅新增 grading.json。另新增本文 qa-independent-comparison-2026-09-06.md。未改输入、断言、旧原始文件或任何包源码。
