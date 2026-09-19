# RQA20 独立结构复核

日期：2026-09-06。结论：冻结测试 **28/28 通过，0 失败、0 跳过，exit 0**；本轮核查范围内未发现包版本、权限或默认方法接线阻断项。不代表专业资格达标或真实模型已加载。

## RED → GREEN 与范围

实际旧源 RED：28 项，7 pass / 21 fail，exit 1。7 个绿项为两个共享正文 hash、三包权限和三包原交付物；21 个红项命中 2.0.0、核心方法文件缺失、requiredSkills/默认路由未接线。保留此历史，不将候选结果反填旧基线。

本轮独立命令（仓库根运行，真实仓库 TS resolver）：

```powershell
node -r ./scripts/register-ts.js --test tests/rqa20-professional-method-contracts.test.js
```

冻结文件 `D:/aispace/knowme/tests/rqa20-professional-method-contracts.test.js` SHA256 始终为 `9D789BC79F3EDD578F0E547B72BC8720CA909473DDC851DFEB5E695F2F85DC80`。本轮仅新增本报告；未修改生产、包、catalog 或测试，未运行 fullcheck、API、QA 或安装操作，未访问用户 APPDATA。

## 独立检查结果

实际读取 canonical/legacy/EXPERT 并经真实 parse、loadExpert、resolveOutputSpec、catalog、loadSkillL1 和离线 assembleCapabilityContext 检查：

| 专家 | E/C/L/catalog | 唯一必需核心 | 可选辅助方法 | 实际 L1 正文字符数 |
|---|---|---|---|---:|
| content-strategist | 2.1.0 一致 | content-strategy-method | writing-polish | 1134 |
| creative-director | 2.1.0 一致 | creative-concept-method | writing-polish、visual-brief-prompt | 1157 |
| data-analyst | 2.1.0 一致 | data-analysis-method | business-metrics-analysis、business-cause-analysis | 1333 |

三核心 Skill 的 frontmatter/manifest/catalog 均为 1.0.0，与专家包版本分别管理。L1 返回正文与解析出的实际 SKILL.md body 完全相等，均 `truncated:false`；离线核心装配块（含包装）均小于 2400 字符。字符数不作为专业评分。

- 三包均保留 `output-1` / `output-2`、`type:answer`、`required:true`。标题分别为内容“内容策略与核心叙事 / 带优先级的选题计划和验收点”、创意“核心创意概念 / 主文案与视觉 Brief”、数据“数据质量检查与分析过程 / 带证据、限制和建议的结论”。
- 每个声明交付物仅要求自身核心方法；当前真实结构 `metadata.knowme.execution.routes` 各有一条 `default:true` 路由，`requiredSkills` 同为自身核心。不以依赖安装列表替代任务路由，也未假定不存在的 default 字段。
- 默认首次、accepted 后下一项、changes_requested 修订正确选中；自定义 primary/多交付物保留用户 id/title/type/required 及额外 requiredSkills，核心通过默认路由合并，不覆盖调用方数据。
- 离线默认/primary 装配仅调用核心 L1，不强制 auxiliary 进入 L1；writing-polish / visual-brief-prompt 显式选择控制通过。DA 两旧 helper 的可选声明和 E/C/L 一致性已检查，但冻结测试没有对其逐个追加显式 L1 装配控制。
- 三专家权限均保持 connectors.allowedConnectorIds=[]、tools.allowlist=[]、network/write/externalWrite=false；connector 依赖和 E/L/runtime connector 绑定为空。三新核心 Skill 同为上述全关闭权限、dependencies=[]。
- 默认输出、默认路由投影、核心 grounding 和核心上下文均无 requiredTools、requiredConnectorIds、requiredEvidence、requiredArtifacts 或 completionConditions，不强制生成文件。这不是取消用户另行显式声明的工具/证据契约。
- DA 旧 legacy 的 business helper 与旧 E/C 不一致，本次变为三层一致且两个 helper 均 `required:false`，不将它们全塞入 primary。

## 文件指纹

以下均为本轮读取的磁盘 SHA256。前缀为 `D:/aispace/knowme/src/catalog/`；是核查时点指纹，不声称覆盖之后的并行修改。

| 相对路径 | SHA256 |
|---|---|
| catalog.json | 48A64A89F76EEFEAF6B5EC5F0EFCD4318A1C44A3F7FF31AE7C0A5029296826F8 |
| experts/content-strategist/EXPERT.md | E5833EC83CCE470748442253D0737A1258E1CDA969CAAA16EE4366EB5AC432F3 |
| experts/content-strategist/capability.manifest.json | 24D7137799E58D9477952B3E211AC0CB701A946A876737D1C567A9F495226475 |
| experts/content-strategist/manifest.json | 6DD0EFB5530CC5EEC98122EA22D5481E42D4A122A5FB7B4441A0D5382BE50FEE |
| experts/creative-director/EXPERT.md | 9FDC5F265DB352D6A5AAD0A37B0191969206DB1394289E12F70FF714389196C5 |
| experts/creative-director/capability.manifest.json | 9403D60E8D124279BC285C0AD16AB1EEC8A6158E78F61339D7CC685A6A91C9BE |
| experts/creative-director/manifest.json | DE9E5FD462BBF25E0FD5B945549ACA862B6D738912ED00588294BE5DD9595A4C |
| experts/data-analyst/EXPERT.md | 42DACB9AA498A21D49061B0F9CAA36654A3D6A09D586D96553360039DF1ECA2B |
| experts/data-analyst/capability.manifest.json | 642774880AB8E5A8234AB5CA3820AB8E304E614971C49FA092C9325A68CD2C66 |
| experts/data-analyst/manifest.json | 6007EC37F979060AC12CE34D2A2939239660780A49C24CE87F1E759373503569 |
| skills/content-strategy-method/SKILL.md | DCE9667365D55853AB7A385DE10FA338D282EAC53050FA6E4426D170FBA24D79 |
| skills/content-strategy-method/capability.manifest.json | D50B584BBF567F2EC24147200B35AA9A0210EB150E6E4EE3826A45E751E3F190 |
| skills/creative-concept-method/SKILL.md | ACB33851A5F233F6FAC2E04430726F2D060189A2775CB9CB405248859C564148 |
| skills/creative-concept-method/capability.manifest.json | 52D09905A8231129CCE157DD361A4D5DF85357B41AE19C8F8CCF8CFCBCE9BA07 |
| skills/data-analysis-method/SKILL.md | C3A2650715FE87DCA6A8FD139C61457B8EA8656EF9C5B3A3ED25589F349ECFC2 |
| skills/data-analysis-method/capability.manifest.json | 1F0579D51A2E3CBC2BCA58FA0EC9BDBAD76FAAC57CA93DDC0A71846979964065 |

共享正文与预先冻结 RED 期望完全一致：

- `skills/writing-polish/SKILL.md`：`1186DA38FB069BBB33C9E4256F99063EDF004E3F5D02C753EFF84C1EC2E034A0`。
- `skills/visual-brief-prompt/SKILL.md`：`D843AEFC1AABD83560F5A6FDA524C56CE8258884463020F6E2D169F588874A58`。

## 边界与剩余验证

GitNexus UNKNOWN / lower-bound **不是安全证明**。本轮没有修改生产符号；结论来自限定源码读取、冻结不变量和实际离线测试。git diff 中包含早前/并行 catalog 变更，不能全部归因于 RQA20；共享正文“不变”是相对本轮 RED 指纹，而非相对仓库 HEAD 的历史状态。

这些测试检查结构和方法文本传递，不判断方法正文语义充分性；没有证明安装器落盘、旧会话刷新、实际模型请求或 same-run contextAudit。runtime 的 `source:'live'` 在此仅表示本地即时读取，不是模型实跑。“默认不强制 auxiliary L1”也不等于 auxiliary 不会出现于 L0 摘要。共享 helper 的 hash 控制覆盖上述 SKILL.md 正文，不扩称所有辅助包文件均未变化。

后续需按主线提供的 task/session/run 绑定核查旧/新 12 次真实运行、installed 内容和 skillRefs/explicit-content；再另做专业评分。整包包含 SOP、提示、依赖和路由变化，不能据结构绿测或后续旧新差异声称纯 Skill 因果。

## 追加：主线 check27064 失败后的独立取证

主线报告全量 check27064 exit 1；本代理未重跑 fullcheck，也不将该结果归因于 RQA20 包。收到通知后未修改/放宽任何测试，完成以下实际复跑：

1. 冻结 RQA20 单文件仍 **28/28 绿**。但该轮前后 `agent-context-assembly.ts` SHA256 从 `73A617053BF11036F357C31CB2998DE13E4FE29198FE05F3E0D46D8B72156402` 变为 `9F8AEBD91CFEBE966444FF246A0A7C22400EB9DD18580C63F05FC5832E6E0ABA`，实证存在并行磁盘漂移，不能将这轮绿色绑定为最终稳定源码。该轮冻结测试、catalog、skill-runtime、expert-runtime、expert-execution-profile 前后未变。
2. 随后组合复跑下列五个文件，实际 **111 项，101 pass / 10 fail，0 skip，exit 1**。其中 RQA20 **28/28 绿**；RQA15 19/23，capability-integration 19/20，RQA16 25/29，skill-progressive 10/11。

```powershell
node -r ./scripts/register-ts.js --test tests/rqa20-professional-method-contracts.test.js tests/rqa15-professional-method-contracts.test.js tests/capability-integration.test.js tests/skill-progressive.test.js tests/rqa16-production-repair-budget.test.js
```

组合前后被记录的以下文件指纹一致（这是限定文件的稳定窗口，不是全仓原子快照）：

| 文件（相对 D:/aispace/knowme/） | 前后相同 SHA256 |
|---|---|
| src/lib/agent-context-assembly.ts | 9F8AEBD91CFEBE966444FF246A0A7C22400EB9DD18580C63F05FC5832E6E0ABA |
| src/lib/agent-capability-scope.ts | 87AE1DD4594D99C7243F80703AB4B543BB0CD4FEA2B277C1F561B73993223CA4 |
| src/lib/skill-runtime.ts | 57722584F5C03757DE019356566D3CDCD9AA6C30F6977287662EA5F60988A0A6 |
| src/lib/agent-tools-surface.ts | 46CB19F42972B59DBCFF10EF8FDF32A55F0F6D148CA5FFD64AB864ABD17D620A |
| tests/rqa20-professional-method-contracts.test.js | 9D789BC79F3EDD578F0E547B72BC8720CA909473DDC851DFEB5E695F2F85DC80 |

### 实际失败与归因边界

| 分支 | 本轮直接证据 | 不能扩大为的结论 |
|---|---|---|
| legacy slash（1 红） | `tests/capability-integration.test.js:156` 期望 `/Legacy OKF/`，实际 L1 空。fixture 的 legacy record 可找到，但 loadSkillL1 返回 ok:false；当前 assembly 已移除针对 `record.source === 'legacy-okf'` 的 legacyRefs 分支，读取失败后不再走原 legacy 文本回退。此 fixture 无专家包。 | 不能归因于三新方法或认定必须恢复任何无授权回退；兼容与能力范围边界需共享实现负责人处理。 |
| RQA15 SE/SA（4 红） | 均落在 `tests/rqa15-professional-method-contracts.test.js:108` 的 `optional.ok === true`。之前 99–106 行的核心调用、全文及 explicit-content 断言已通过。只读本地探针显示 `loadSkillL1('code-review')` 返回 `model_invocation_disabled`，加 `invocation:'explicit-user'` 则 ok:true、125 字符、未截断；writing-polish 默认及显式均成功。 | 本轮不是“核心 explicit block 不见了”；不能借主线早先失败摘要覆盖当前准确失败位置，也不应未经确认改旧断言。 |
| RQA16（4 红） | budget/artifact/repeated/after-tool 在 `tests/rqa16-production-repair-budget.test.js:150` 或 `:160` 比较首个 tools 名称时，实际 discover_tools，期望 operation。对应失败位置前的断言已通过；12 项 length/cap/参数预算矩阵及直接 adapter 边界全部绿。 | 不证明实际预算接线回归；也不证明失败位置之后未执行的断言通过。工具列表/顺序兼容另核。 |
| skill-progressive（1 红） | `tests/skill-progressive.test.js:37` executionContract.requiredTools 实际 []，期望 ['search_docs']。此前 activation 和正文断言通过；这是 tmp demo fixture，与三专家包无关。 | 本轮未追完该 metadata 过滤的完整因果链；不能直接定性为合法授权过滤或数据丢失。 |

结论：新 28 项在当前观察到的组合中未受这些分支影响，但不覆盖 legacy 回退、code-review 默认自动调用、生产工具列表顺序或有 requiredTools 的 activation metadata，因而不证明共享运行时回归已关闭。已读取的源码 diff 含其他并行/历史工作，不能仅凭 diff 定位引入者或精确提交。

主线说明隔离 QA 主进程未重启、保持旧新同进程；本报告将其作为主线提供的运行条件，不把当前磁盘运行时失败投射到该进程，也未自行检查进程模块缓存。真实 same-run 审计仍待主线提供绑定证据；本轮无真实任务/API 调用。
