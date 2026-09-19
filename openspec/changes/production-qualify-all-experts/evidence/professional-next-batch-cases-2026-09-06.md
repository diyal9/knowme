# 下一批三专家专业方法案例（冻结、非盲、未执行）

题面及评分口径：[professional-next-batch-cases-2026-09-06.json](professional-next-batch-cases-2026-09-06.json)。仅新增本说明和该 JSON；未改 src、包、既有评分、QA 配置或用户数据，未调用真实模型/工具、未运行资格案例。

## 选题依据

保留用户优先的三位，没有换选。只读依据为当前 change 的 expert-rubrics.md §19–21、§8.2–8.3 资格矩阵，tasks.md、qa-plan.md、第二/第三批真实报告及 professional-methods-workspace/comparison-status.md；另检索当前 change 内三专家 ID 的 md/json/jsonl 记录。未找到足以满足范围资格门槛的真实样本；这不是断言其他未审环境从未运行过。

三专家 E/C/L 当前均2.0.0，源码包全文已读。software-engineer/solution-architect 必需依赖 code-review，user-researcher 必需依赖 writing-polish；两份 Skill 全文亦已读。方法依赖不是方法实际进入模型的证明：三包默认交付没有 requiredSkills，需记录实际 L1 装配。原矩阵中的安装差异仅作历史，不据此推断当前用户安装。

| 案例 | 专家与本题专业区分点 | 正常交付形态 |
|---|---|---|
| SE-N01 | software-engineer：双进程库存超卖、租户幂等、事务原子性、提交后丢响应；要求最小完整修复及受控失败时序 | 正常答复中的可审查代码/补丁提案、反例和定向测试设计 |
| SA-N01 | solution-architect：8小时离线诉求与5分钟撤权硬要求冲突；比较可行策略，处理过期在途结果、旧权限乱序及安全回退 | 有条件的架构决策记录、接口/职责、权衡、迁移和可测验收 |
| UR-N01 | user-researcher：9条记录仅6人，重复事件与诱导提问，满意反例和单人高潜在影响风险；从证据走向决策及可反驳的研究 | 证据编码/等价映射、主题反例、机会取舍及最多6名额的研究计划 |

全部是合成自包含材料；题面不依赖外部文件、现行法规、产品报价或实际用户记录。模型只需交付正常对话，不需要创建文件、发送消息或调用外部工具。

## 评分与使用边界

- 每例固定5项可核验 expectations，另给题面锚点、判分说明和硬失败条件。每项要求实质正确，不按篇幅、Skill长度、术语、章节数或平台review/verified评分。多种符合约束的方案均可通过，不锁定技术栈、措辞或唯一优先级。
- 依 skill-creator/grader 流程，后续采用 text/passed/evidence，并额外检查 claims 与 eval_feedback；代码、表格、尾注、建议中的无据理由都在范围内。合法且明确的建议不作事实错误；经证实的硬伤不能被局部5/5抵消。
- 执行器只接收对应 prompt，不能把 expectations、assertion_notes 或本说明中的判分口径作为任务材料。完整 JSON 交评分员。记录实际 task/session/run、输入摘要、原始答复/工具回执、包摘要和同 run Skill内容hash/chars/truncated，不按时间或数组顺序猜绑定。
- 平台阻断且正文不可恢复时，专业评分 N/A、工程失败另记，不对替换拒绝文评分。未执行不预填通过、耗时或成本。
- **非盲测**：设计者已见专家包、矩阵和既有专业问题，主线也可见判据。本件是执行前冻结的诊断题，不是未用于调优的保留题；若用结果调方法，之后需另设未指导修改的案例。当前没有任何输出对照，不能声称已证明“专家优于普通回答”或纯 Skill 因果。
- **软件题特意限定静态提案**：现包 write=false、空工具allowlist，不能假定有工程执行能力。即便本题通过，也不补齐矩阵要求的授权隔离仓库真实 diff、同版本实际测试及变更保真。架构基准、研究招募同样仍未执行。
- 一题不替代两正常案例（含保留题）、异常/反例及实际反馈续作。本批包含题内反例，但没有真实异常闭环或反馈轮证据，B4及相关功能项不能预填通过。

技能使用影响：采用其“实质断言＋额外claims＋断言缺口检查”设计；遵从本次仅设计的授权，不执行技能通常建议的模型运行、viewer或迭代改包。未探索/编辑生产符号，故无符号变更impact；未提交。

## 冻结与检查

JSON SHA256：`f28ebe2534c7b15ba56965ba5a4cfded068b8b0c7bd0f992819dfc1e17600817`。

摘要计算：prompt 使用 JSON 解析后的字符串 UTF-8；expectations 使用 `JSON.stringify(expectations)` 的 UTF-8。执行前核验原文件，若需更改另建版本，不事后移动断言。

| 案例 | prompt SHA256 | expectations SHA256 |
|---|---|---|
| SE-N01 | 3070812ef1bbef7d7cefa4128aa4cccd82ec5b69d8628be40cdff07d75878769 | 301399f9b1421e788c7e5874103e424dabf9e8c9bd1179aee171a13b9a18b60c |
| SA-N01 | b67d3c386ab559d78ab31f0fdf9388d77bd1f9b36a43d608ced8f3f7758bebec | b606f0f891f4fd6e22e5ef2e2ac82e2a8435a8ee072b10298dcc9c05914551e5 |
| UR-N01 | 7a43f6563b6a5002be26e41d63515039934a845b3a3e3c13f7cdf9a031a53511 | c898e2808ab5dd919f932a9b858dd0eeb7e8c62e3a3f18503099bd24c3daa0fb |

只读 Node 结构检查通过：JSON可解析、3个唯一专家、每例5断言及5判分说明、硬失败非空、附件列表为空、均 frozen_unexecuted/blind=false、无grading。题面分别1621/982/1027个JS字符串字符，均低于既有8000字符单材料入口；这只是避免已知输入截断的组织检查，不是以长度评分，也不证明实际L1/材料链已加载。

所读源码 EXPERT.md SHA256（只作设计时快照，不冒充实际加载）：

- software-engineer：71c46eab6285862766054da788e32edebb1853fffbe7cbe74439b772c173e23a
- solution-architect：03f1ae1e1526f175f0e4389d2332e325c71220d612c82da6a73435bd14bb01b6
- user-researcher：ff040ea4e166396f64077a1e842f01c3dfc1662a1bd9e59b032b91368e9805f6
- code-review/SKILL.md：17d5214576de283419285d6da3b1ea7a797cdcf825e125468b53beb2fbcdca8e
- writing-polish/SKILL.md：1186da38fb069bbb33c9e4256f99063edf004e3f5d02c753eff84c1ec2e034a0

下一步由主线选择实际运行窗口和配置；本件不授权任何真实模型运行或隔离仓库改写。
