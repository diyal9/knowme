# 第三批真实专业任务：行动项、需求评审、测试设计

2026-09-06。仍为隔离Electron+Qwen3.8 Flash真实运行，无输出fixture，无真实用户数据写入。输入先冻结在professional-batch3-inputs.json；原始会话在professional-batch3-live.json，任务状态/权限快照/事件在professional-batch3-task-events.json。按taskID绑定，不能按会话数组顺序关联。

## 装配与工程基线

仅在已有隔离QA副本将三位专家E/L/C复制为canonical源码2.0.0，之前QA包保存到skill-evals/professional-batch3-workspace/previous-qa-packages；未升级用户APPDATA。重启的也是QA Electron，不是用户原应用。实际assignmentSnapshot确认SOP hash：action-owner=55d19edc3f0e143d，requirement-reviewer=872370944fad2e62，qa-engineer=e999616a126c2cb1。

三题均为用户指定的单份primary answer，原包默认output-1/2没有requiredSkills；这不是专业方法全部实际进入L1的认证。源包前两位主要依赖通用writing-polish，测试专家仅依赖短code-review，而非系统测试设计方法。SOP进入实际任务文本已由会话原文确认。

当前源码完整check41442 exit0（backend/lint/renderer80文件559项/typecheck），不代表以下专业输出通过。主线治理差异已做GitNexus detect_changes；全脏工作区范围巨大且含并行无关修改，不能将全仓结果冒充本轮隔离影响审查或全仓安全保证。

## 实际结果与主线初评

| 案例 | task ID | 实际结果 | 专业/工程初评 |
|---|---|---|---|
| AO01 行动承诺与相对依赖 | task-mtotfwwc-jfxne | review，有完整表，无工具调用 | 关键提取较好，仍有无依据附加判断；未认证 |
| RR01 需求冲突与可测性 | task-mtotfx1i-lg9q9 | review，search_knowledge返回未找到相关条目 | 冲突识别有效，长度超限、待定规则被部分写死；不合格 |
| QA01 测试证据分级 | task-mtotfx67-mplj8 | failed，知识工具错误，无助手专业正文 | 执行阻塞，不能评为专业通过 |

AO01正确合并[1]/[4]，保留李明9月8日与验收人；王芳保留确认后两个工作日及标准未知；回滚主责不挑选个人；自动提醒明确只是建议。但额外写“需主持下次会议裁决”和回滚“阻塞面最大”：材料没有指定裁决人或阻塞影响排序。建议可以提出，但依据和已定责任不能补造。另“无依赖”应审慎区分未说明与确定没有依赖。raw564不当作超500证据；CJK293+字母数字块24，未见该长度口径超限。

RR01识别§1/2权限、§3/4软删除冲突，明确静态评审，未声称真实漏洞已复现；没有新增审批或邮件。但§6后台是否继续未决定，正文建议后台继续后，在WHEN/THEN又直接使用继续执行；应保持待决策/条件化，而非将自己的建议当确认规则。§7要求速度可测却没有可操作的耗时验收式；抽样无遗漏不能单独证明完整集不丢数据。正文仅CJK已有727，超过700字约束（raw1290并非判据）。search_knowledge空结果不支持对整个知识库不存在相关规范的完备断言。

QA01实际顺序以任务events为准：knowledge_search未注册 → kb_get错误 → fabric_search返回 → kb_query错误 → failed。会话run.steps仅存前三个工具，没有最后kb_query，故不能把会话工具列表当完整执行记录。失败原因是当前Agent未获授权读取local-pkg:okf；没有交付物，没有把错误包装answer。输入已足够做静态测试设计，不需要另取该知识库。知识库权限拒绝是正确边界，不应靠放开它完成此任务。

## 新增平台核查 RQA11（尚未修复）

RR01/QA01 assignmentSnapshot均声明tools.allowlist=[]，却进入知识工具调用；source中的minimal工具分支直接createToolSurface，疑似跳过统一治理。已委派只读追踪与受控反例：须确认实际模式/权限传递、模型投影及执行检查，不以猜测宣布根因。治理拒绝、可选错误的恢复和模型擅自检索是不同层问题，不应仅隐藏错误继续输出，或为单个专家特判。

## 真实失败界面

打开QA01并等待“返回专家协作”实际可见后核对：主输入框1、重新执行按钮1，具体权限错误在正常对话中，无伪文档/伪成果。截图qa01-knowledge-failure.png已由主线实际查看。导航转场立即取body曾只有应用壳、inputs=0；等待页面完成后输入框正常，不能将转场抓拍报为输入框回归。

仍有文案问题：首次执行没有成果，通用失败提示却写“已有成果和修改意见已保留”。当前只记录，未改UI。未点击无意义重复重试；原始错误和材料保持。

本批不替代剩余专家正常/异常/修改/重开与多题留出验收，三者均未获生产专家认证。
