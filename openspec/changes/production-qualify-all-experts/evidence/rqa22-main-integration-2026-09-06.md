# RQA22 — 通用核验修复上下文与数据分析复验

2026-09-06。阶段进展，24专家总体目标仍 ACTIVE，无新增生产合格专家。

## 落地范围

- GROUND 向 FINALIZE 传递实际 postProcess 后被核验的完整候选、合并的违规信息和当前材料/工具来源，避免仅凭通用指令重新作答。
- 新增内部临时 grounding_repair_data：候选正文/hash、同task/run材料快照、具体问题、字段与来源。JSON数据不升权，不持久化原始修复包；metrics仅hash/数量。
- 核验与修复复用 collectGroundingSources 的同一投影，保留既有成功user摘录、成功非discovery工具正文、精确调用绑定及来源别名规则，不扩大证据授权。
- 修复指令与数据一起纳入现有完整上下文预算；128KiB整包超限失败关闭，不裁剪尾部。仍只允许一次、无工具修复，并重新执行原核验与完成契约检查。
- 修复标签复用安全标签校验，但不使用界面的8项展示上限。材料和来源目前存在保守重复，可能较早触发预算上限，尚未做去重优化。

涉及源码四文件：agent-grounding-repair.ts、agent-grounding-ledger.ts、agent-run-executor/phases-ground-persist.ts、agent-run-executor/phases-model-tool.ts。未修改专家ID路由、专业Skill或用户日常数据。

## 检查和独立审查

- 新增 tests/rqa22-grounding-repair-context.test.js：39/39；相关预算、诊断、材料流与工具正文回归：69/69。
- 新测试初次发现：第9个合法问题标签被UI上限截掉，已修源码。工具来源两项失败则是新夹具误期待裸正文；既有toolSourceContent会保留doc_token和body键前缀，改为严格匹配该原有完整投影，仍检验请求回显被排除，未放宽来源规则。
- 测试使用真实executor、生产请求适配和stream parser，但传输/副作用是离线夹具，不当作真实模型遵循证明。
- 完整 npm run check（session94032）exit0，lint/typecheck通过，renderer85文件597项通过。后端日志采集被截断，未猜测项数。
- 独立只读审查未发现此四文件新增P1；标签末次hash也已复审。详见 rqa22-repair-contract-review.md。
- impact：verifyClaims LOW（1直接调用方，GROUND与run受影响）；finalizeResponse和completeWithinBudget HIGH，执行前已告知并覆盖公共路径测试。新helper不在索引，risk UNKNOWN，以当前调用方补充检查，不能称零风险。
- detect_changes(scope=all)：整树320文件/699符号/172affected，CRITICAL。这包括大量既有与并行改动，不能归为本轮四文件，也不等于全部已审；未提交、未覆盖他人工作。

## 真实隔离复验与专业评分

任务 task-mtpfjl7x-wrrq6，R20-DA-N01冻结输入hash 14402068a107a09437ec59c9ee1324284d2126423ea243e34042b03c430c5589。使用自有隔离QA profile（PID9072），重新加载上述源码；installed专家2.1.0，专业Skill本轮未变。通过现有公开创建/执行接口发起同题新任务；透明核验观察器仅记录，不改变返回，结束已恢复。

- 首轮一次核验即通过，进入review。答案总体原版50.00%、新版40.00%，差−10pp，两个客群均+10pp，算术正确。
- **没有发生 grounding FINALIZE**。因此本次真实run不能验证数值修复分支，也不能宣称历史40→42回归已经解决。离线请求测试仅证明原稿/来源进入修复请求，不保证语义正确。
- 独立专业6/7：算术3/3、授权及篇幅合格（mixed726，要求500–750）；关键因果判定失败。答复把“缺乏改版有害的证据”写成“已排除改版本身有害”，即使另段有非随机免责声明也不能抵消全文矛盾。详见 rqa22-data-analysis-grading.json/md，含保留观测值不变的反事实反例。
- 没有真实外部工具调用或额外文件产出。primary answer是平台对话封装。
- 这不是Skill A/B；未虚构baseline、token数量或能力认证。

## 交互观察

- review状态有完整对话答案、验收入口及唯一可见主输入框，截图 rqa22-da-review.png。
- 刷新返回工作台首页，而非自动恢复房间；初次等待房间按钮30秒超时已记录。随后经工作台显式重开同任务，正文40.00%与唯一输入框恢复。
- 点击“退回修改”后仍只有1个可见输入框，焦点在原框，截图 rqa22-da-reopened-revision-focus.png。没有提交修改意见、没有执行v2，也没有接受成果；不宣称修改生成闭环已验收。
- 滚动区底部验收按钮在当前截图部分临近裁切边界，实际可滚入并点击；本轮未修改布局。媒体预览不在本次数据分析验证范围。

官方静态查看器：../skill-evals/rqa22-data-analysis-workspace/review.html，保留原答复与正式评分供人工复核。

## 后续与未完成

1. 用真实触发修复的任务验证原稿/依据保留及数值稳定性，不能用本次首次通过替代。
2. 专业方法需统一处理“观察相关、因果推断、条件建议”的证据边界，并用新案例验证，不能把冻结题答案写入Skill后继续称盲测。
3. 其余专家专业质量、正常/异常/修改闭环和媒体体验仍按全集资格清单推进。

本轮源码指纹与原始task/session/capture均在 rqa22-data-analysis-run.json；工程门禁摘要在 rqa22-check-summary.json。不得以工程绿测或6/7评分宣布总体完成。

