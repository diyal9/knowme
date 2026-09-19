# RQA13 与第四批真实专业评测

2026-09-06。本轮有实质进展，24专家生产资格目标仍进行中；不是全部完成，也不是被外部条件阻塞。

## 平台误拦截的可复现原因及修复

此前RR01只有通用ungrounded_external_fact错误，不能据此判断模型捏造。仅在隔离QA Electron 9223临时观察runtime.verifyClaims：原函数先执行，原返回值不改，按providedMaterials.taskId限定目标，最多收两次校验；观察结束恢复原函数，之后重启QA。没有用户应用9222、用户安装或权限变更。

实际run `expert_task-mtowzdmo-c9tm5_mtoz5d0m` 两次校验都只拦截“评审结论：阻塞（需修改）”，误将本地评价当外部事实。原稿与校验结果保留在rqa13-rr01-observed-rounds-2026-09-06.json；这是两个verification pass，不冒充两个独立任务。

只改agent-claim-source-check.ts：有限本地评审前缀和纯评价词/单层配对括号可识别为评价；显式引用、事件归因、括号事实、相邻负责人/日期以及执行声明仍校验。来源抽取保留评价字段，真实引用可以按片段核验。没有专家ID分支、没有修改工具/成果必需合同。仍不保证任意自然语言语义真实性。

新符号impact为UNKNOWN，已补查直接调用：labelledClaims由checkProvidedFieldClaims抽取输出和来源，后者进入verifyClaims；verifyClaims影响LOW，直接调用GROUND再到Executor。源码改动前执行impact，并告知范围。独立原20例14绿6红，修复后定向63绿；独立再补2组，最终86项相关回归全绿。主线已读独立最终报告及新增测试。

完整 `npm run check` session15178 exit0，test/lint/renderer80文件560项/typecheck通过；随后仅独立新增两组边界测试，无生产代码变化，补测86绿。首次直接node --test漏register-ts只产生模块加载错误，不计作行为红测；已用仓库注册器正确重跑。git diff --check通过；共享整树detect仍305files/569symbols/160affected、CRITICAL，包含既有及并行修改，不宣称全树已审，不提交。

## 真实重试与交互

修复后同一任务新run `expert_task-mtowzdmo-c9tm5_mtozc5xx` 正常review，gate verified、0工具、0违规；没有继续临时观察包装。完整task/session在rqa13-rr01-postfix-live-2026-09-06.json，旧失败记录保留。

隔离Electron1280×820实际打开、滚动到验收、刷新返回工作台并重开：主输入框1个、接受成果入口可见；未点击接受。截图rqa13-rr01-review.png、review-bottom.png、reopen.png。第一次用未截短列表标题定位失败；改用实际可见标题。刷新后一次滚动因轮询重渲染元素脱离DOM，重新定位成功；不把测试定位异常冒充数据丢失或全面稳定性证明。

RR01新交付独立专业分2/5，未合格：无据规定提示后1分钟必须可下载，权限/软删除口径未组合，数量一致不能排除漏重记录，全文741混合单位超过700。详见rqa13-rr01-professional-review-2026-09-06.md。工程修复不改变旧12次对照评分，也不将原拒答评分改成新结果。

## 第四批：当前安装包基线，不是新方法收益证明

冻结输入为professional-next-batch-cases-2026-09-06.json（SHA256 f28ebe2534c7b15ba56965ba5a4cfded068b8b0c7bd0f992819dfc1e17600817）。三个自包含静态案例真实执行，模型qwen3.8-flash，评分断言未送入模型。每例一个primary answer请求，实际解析requiredSkills=[]；安装快照均2.0.0。此为已安装包的实际基线，不能冒充源码新SOP已安装，也不证明默认多成果路线表现。

| 案例 | task | run尾码 | 平台 |
|---|---|---|---|
| SE-N01 软件工程 | task-mtozhwxb-u3xwt | mtozhx2v | review |
| SA-N01 架构方案 | task-mtozhx32-ycfem | mtozhx8j | review |
| UR-N01 用户研究 | task-mtozhx8r-07xq1 | mtozhxe7 | review |

完整runId为expert_加taskId再加尾码。skill-evals/professional-batch4-workspace中保留每例输入、当前run消息/任务快照和原始答复。live.json明确为选取字段，不是整个历史session导出。当前只有基线，old_skill是后续对照目录命名；没有候选效果或纯Skill因果结论。

同run日志rqa13-batch4-context-audit-2026-09-06.json确认三例skillRefs=[]、无skill.explicit-content；bindings中有code-review/writing-polish并不等于正文已加载。RR01则实际装配requirement-review 1024chars，未截断，仍有专业错误。两个事实分别说明装配和方法质量都必须验证。

软件及架构正文分别止于“固定seed的调度”和“否则C4”，未完成句子却进入review。可确认交付不完整，当前证据不能确定是供应商token终止、模型主动停下或其他环节造成。源码getStreamSnapshot保留finishReason，但执行层未见对应检查；需继续run绑定诊断，不能只按文本尾标点自动认定token耗尽。

评分与原文在各case目录。软件4/5、架构3/5、用户研究0/5，三例均不合格；分数是冻结五个复合断言结果，不是连续能力量表，也不是每个失败项的所有子项都错。软件和架构由非作者独立评分，研究题由设计者评分，明确非盲。主线已全文读三份报告和原始答复。

软件修正代码由主线另用se-code-probe.cjs合成M2事务夹具验证，6/6绿；这不是专家工具回执、真实数据库验证或专业认证，不能补足其原答复的错误解释/缺失用例。其不同requestId唯一键冲突故事、5扣4后再扣4的故事不成立，并把未知测试覆盖说成缺失。架构把许可剩余有效期改成断网后约5分钟，迁移回滚/验收未写完；研究把两人写成三人、身份映射错、把不确定的刷新效果判为有效。正确局部保留，不用额外错误抹掉正确代码或准确引语，也不让局部分数抵消全文错误。

静态查看器使用skill-creator提供的generate_review.py生成。打开请求返回queued，不声称用户已经看到。不因测试、篇幅或工具数认证专家，不覆盖输入/旧评分，未改用户任务内容。

## 后续范围不缩减

继续补实际方法绑定/包升级一致性、专业反例与修订后重复及未指导修改的题目；查清不完整响应仍被标交付的通用链路。全部24专家正常/异常/取消/重试/修改/重开、真实生图及统一预览、发行/安装验收尚未闭合。不能把本次小范围修复或三个静态案例作为总体完成标准。
