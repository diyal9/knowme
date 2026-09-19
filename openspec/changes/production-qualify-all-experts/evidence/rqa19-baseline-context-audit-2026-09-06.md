# RQA19 baseline 六轮上下文装配审计

2026-09-06。本报告固化此前已完成的只读核查，不新增探索或重跑。没有实际任务/API/模型调用，没有生产、测试、原始证据或评分修改。仅访问本change保存的baseline与用户指定隔离QA根；未读取用户APPDATA。installed记录中的历史APPDATA provenance路径只是被保存的字符串，未沿该路径访问。

## 结论

六个baseline task → session → run绑定均核对一致，未混入同任务后续retry。三专家installed均为2.0.0；session的Skill bindings与SOP和baseline保存的installed记录一致。

六轮真实 `llm-system-prompt` 日志均为 `skillRefs=[]`，manifest没有 `skill.explicit-content`；CS/CD有 `skill.auto-summary`，不能称“完全没有技能上下文”。DA没有Skill块。六题交付契约均为 `requiredSkills=[]`。

这证明本轮记录的装配没有显式L1 Skill正文，不证明专业失败原因，也不单凭依赖声明断言runtime丢字段。安装依赖ready、L0摘要入选和L1正文装配是不同层次。

## 来源与精确绑定

- baseline：`D:/aispace/knowme/openspec/changes/production-qualify-all-experts/evidence/rqa19-baseline-live-2026-09-06.json`
- baseline文件SHA256：`A01E00045E357F7CCB24C11701AFF1AF94BBA81BECC0A900203B74193A9DA9CD`
- 指定隔离根：`D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`
- 文件系统解析的同一路径：`D:/UserCaches/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de`
- 下表日志行号对应隔离根下 `logs/knowme-2026-09-06.jsonl`，每个run恰好找到一条同run的 `llm-system-prompt` 装配记录。
- 每轮另核对 `agent-runs/<精确runId>/state.json` 的runId/sessionId、`events.jsonl`运行事件，并检查 `checkpoints/latest.json`。绑定从baseline的 `rows[].task.executionEvidence.runId` 出发，不按最新目录或时间邻近猜配。

| 案例 | taskId | sessionId | baseline runId | 日志行 / UTC时间 |
|---|---|---|---|---|
| CS-N01 | task-mtp8aibr-w1rk8 | wb-expert-task-mtp8aibr-w1rk8 | expert_task-mtp8aibr-w1rk8_mtp8aipf | 428 / 2026-09-06T03:04:40.572Z |
| CS-H02 | task-mtp8aj6w-5z3xb | wb-expert-task-mtp8aj6w-5z3xb | expert_task-mtp8aj6w-5z3xb_mtp8ajjp | 430 / 2026-09-06T03:04:41.430Z |
| CD-N01 | task-mtp8cvb0-siq2z | wb-expert-task-mtp8cvb0-siq2z | expert_task-mtp8cvb0-siq2z_mtp8cvre | 440 / 2026-09-06T03:06:30.718Z |
| CD-H02 | task-mtp8cw5t-yuns6 | wb-expert-task-mtp8cw5t-yuns6 | expert_task-mtp8cw5t-yuns6_mtp8cwmd | 442 / 2026-09-06T03:06:31.792Z |
| DA-N01 | task-mtp8dxw9-dpdlg | wb-expert-task-mtp8dxw9-dpdlg | expert_task-mtp8dxw9-dpdlg_mtp8dy68 | 452 / 2026-09-06T03:07:20.285Z |
| DA-H02 | task-mtp8dyem-r587w | wb-expert-task-mtp8dyem-r587w | expert_task-mtp8dyem-r587w_mtp8dyoi | 454 / 2026-09-06T03:07:20.917Z |

日志sessionId有脱敏，完整session绑定由baseline session.id、task.execRef.id及同run state.sessionId交叉确认；不是由脱敏后缀单独推断。

## installed、会话绑定与实际manifest

| 专家 / 两题 | installed版本、记录hash | installed及session Skill bindings | session readiness | 任务交付requiredSkills |
|---|---|---|---|---|
| content-strategist / CS-N01、CS-H02 | 2.0.0 / `21a196c32c0707e8` | writing-polish | ready，该依赖ready、issues=[] | [] |
| creative-director / CD-N01、CD-H02 | 2.0.0 / `c881b9fbda76a4de` | writing-polish、visual-brief-prompt | ready，两依赖ready、issues=[] | [] |
| data-analyst / DA-N01、DA-H02 | 2.0.0 / `d911ee5d728c4409` | [] | ready、items=[]、issues=[] | [] |

上表短hash为保存的manifest.contentHash及assignmentSnapshot.agentHash记录值，不冒充独立计算的SHA256。installed的CS/CD capabilityManifest将上述依赖标为required；但没有因此推断它们必须进入每轮L1。三者记录均为legacy adapted manifest，未见正式execution.requiredSkills声明。

六轮manifest共同字段：`version=1`、`scene=expert-collaboration`、`phase=execution`、`executionPolicy=tools-allowed`、`locale=zh-CN`、`promptPackVersion=zh-CN@2`；identity分别为内容策划专家、创意策划、数据分析师。`omitted=[]`、`conflicts=[]`。下表是实际included块的记录值，同专家两轮一致。

| 专家 | 实际Skill块数量 / 显式L1块数量 | Skill块id、chars、hash | persona.sop chars / hash | persona.attributes chars / hash |
|---|---|---|---|---|
| CS | 1 / 0 | skill.auto-summary；228；`9814f660ecd80e20` | 92 / `dfc93f05e61fc31a` | 66 / `a74ee32b7fafbd54` |
| CD | 1 / 0 | skill.auto-summary；413；`daff1ea04ae299e1` | 105 / `7cdcfa8b46f59dd0` | 64 / `5301ef4c804e068c` |
| DA | 0 / 0 | 无 | 88 / `3aa8616357cc4d38` | 66 / `c7ffa6d634510336` |

每轮另有一个id已脱敏为 `per***ld` 的persona块：131 chars、hash `9c4e9cd37b672d21`。不恢复猜测其完整id。所列Skill及persona块均 `truncated=false`；每轮kind=persona块共3个。这里的chars是manifest记载的**组装块长度**，可能含标题/包装，不是原SKILL.md字数；没有另行测量标题字符数。短hash是装配日志的块hash，不是本次对缺失正文重算的SHA256。

块类型解释依据已读源码：`src/lib/agent-context-assembly.ts:121` 将skillL0Block映射为skill.auto-summary，约131行将skillL1Block映射为skill.explicit-content；约242行在显式引用路径调用loadSkillL1。因此摘要存在不等于完整方法正文存在。该源码解释不替代上面六轮实际manifest证据。

## 后续动态加载与可用性边界

- 前五轮state指标toolCalls=0；DA-H02为1，baseline工具记录为 `create_artifact / ok`。没有记录到load_skill调用，不能把工具面出现load_skill名称当作它已执行。
- 保存的 `rows[].session.session.run` 是摘要形态，没有runId、contextAudit、contextManifest或skillRefs字段；这部分本身不能证明L1缺失。结论来自隔离根的精确同run装配日志。
- 未取得逐次完整HTTP请求正文，也没有原始L1正文可做全文hash核对。每轮可用的是一条装配manifest，而非每次MODEL/FINALIZE请求的独立完整记录；不能将装配记录泛化为模型实际注意、遵循或专业掌握了这些内容。
- installed记录、assignment和session一致性仅针对保存的baseline，未读取或比较后来升级的安装目录；同任务后续retry不在本审计范围。
- 未重评分六题，不用kernel done、工具可见、依赖ready或本轮上下文装配证明专业合格；任务层baseline状态与运行层终止状态须分别解释。

本次固化报告未新增QA读取、文件hash采集或其它探索；以上均为前轮已观察结果及其明确限制。
