# RQA30：正式修订工具 scope 只读复审

日期：2026-09-06。范围：现有正式任务→prepare→surface→生产adapter→AgentRunExecutor；只读保存实录与源码、离线mock测试。未调用QA、模型、网络、安装或D02；未修改源码/测试，未跑fullcheck。

## 结论

**未复现现有明确硬权限被更宽的专家权限覆盖。本轮可证问题是：正式任务没有接通可冻结的“本轮只改文字/禁工具”宿主契约；不能把自然语言限制、派生session状态或未支持payload字段混称现有硬权限。当前不据此提出紧急源修。**

`session.executionPolicy`是每轮派生状态，prepare覆盖它本身不是已证明的越权漏洞。把旧chat/planning的no-tools永久锁住会破坏后续确认执行。现有空allowlist才有明确的治理交集约束；本次离线反例没有击穿它。

## D01证据及因果边界

- `evidence/rqa28-d01-case-and-ui.json` 保存的payload仅含expertId/title/goal/brief，无结构化禁工具限制。完整goal尾部确有“本轮仍只授权在对话修改设计方案，不允许调用工具……”的用户要求。
- `evidence/rqa28-vd-d01-actual.json`：task=`task-mtpq4x1j-qp5hk`，同run=`expert_task-mtpq4x1j-qp5hk_mtpq4xf3`；assignmentSnapshot.permissions=`{}`，session.executionPolicy=`tools-allowed`。executionEvidence记录grep_files失败、list_skills两次成功、load_skill一次成功。session.run.toolsUsed只列成功项，不能据此漏掉grep尝试；也不能将grep失败写成成功读文件。
- RQA29已证明该历史任务5180字goal在当时被裁为2000，最新215字修订意见尾部不在任务/请求内。D01是新建clean-history诊断任务，不是同任务review入口。本轮不把它当作“完整禁工具意见已到模型但仍违规”的单因果证明，更不能据旧实录断言最新磁盘硬scope被绕过。
- 保存的session.run没有permissions字段；这不证明当时所有中间运行态均无权限。可确认的是保存的启动payload没有hard deny-all、assignment快照为空；不补造不存在的task/run scope。

## 当前链路与优先级

| 层 | 当前源位置及含义 |
|---|---|
| 正式修订入口 | `expert-task-runtime.ts:537–547` 最新comment进入revision prompt；`:612、625–635` 固定expert-execution，permissions来自专家canonical快照，executionContract仅包含requiredTools/evidence/artifacts/minArtifacts/completionConditions。没有本轮禁止工具字段，也没有从意见推导权限的代码。 |
| API/持久化 | shared/api.ts:41、43、137入口是Record；WorkbenchTask:328–329虽有executionPolicy可选字段，但注释为“当前会话执行策略；规划/讨论固定no-tools”，不是已实现的任务授权契约。workbench-task-store normalizeTask不保留该字段；runtime也不读取它为scope。单纯向payload追加同名字段不具备现有接线保证。 |
| 会话/prepare | agent-session-ensure.ts:23–35规划/讨论置no-tools；prepare:158–166传conversationMode，不传payload.executionPolicy。prepare:272–275正式执行tier=assist；:634–636按模式、tier、模型tools支持重算并持久化policy。context-engine/policy.ts:27–29规划/讨论强制no-tools，其余按toolsEnabled派生。 |
| 硬权限合并 | tool-surface-builder.ts:137–159：payload/deps权限、session.run.permissions、expert canonical、org/parent的显式allowlist取交集，denylist取并集；空数组表示拒绝，不是未声明。专家宽权限不能解除这些窄约束。 |
| surface及动态检查 | agent-generate-tool-surface.ts:60–73优先当前session no-tools，否则prepared policy；:202–216把有效治理交集保留到run permissions。no-tools只临时投影allowlist=[]，不会永久保存该派生态拒绝。:400–410空表及guard；agent-capability-scope.ts:33–57硬层交集/no-tools拒绝；surface guard及capability-execution-check再次检查最新授权/身份/运行状态。 |
| 生产执行链 | agent-generate-runner.ts将payload交给executeAgentGenerate；execute:63–79把surface/executor及派生toolsEnabled交给buildProductionRunPorts，再:176–182调用AgentRunExecutor。adapter:202传toolsEnabled；:227–234仅启用且有定义时加工具请求字段；:252–272派发仍走宿主toolExecutor。phases-model-tool.ts:194同时要求authorized records非空，:662工具未启用时拒绝模型伪造调用。 |

空requiredTools只表示“没有必须执行的工具”，不表示“禁止全部工具”。同样，read-only/禁外发不等于禁止grep、Skill加载或自动检索；若产品需要“仅使用给定文本”，必须明确区分工具执行、宿主预检/检索与静态方法上下文加载的边界。

## 实际离线验证

复用现有测试fixture：在VM内加载测试原文、将node:test注册设为no-op，并仅在内存导出fixture/probe；不改测试文件。服务、模型、连接器为既有mock，以下附加探针不计入套件测试数。

1. **派生状态控制，不作为权限漏洞**：真实prepare函数、formal mode、初始session.executionPolicy=no-tools，再附加未支持payload.executionPolicy=no-tools。输出prepared与saved policy均tools-allowed、tier assist、requiredTools空；planning对照仍no-tools/chat。证明该字段不是跨轮hard限制，不证明宿主承诺被违反。
2. **已支持硬限制对照**：真实buildRunToolSurface及生产builder/registry，分别传入“session.run空allowlist + payload/专家允许calculate”和“payload空allowlist + 专家允许calculate”。两例records=0；calculate不广告、不允许、validation=false、强制executor调用ok=false/code=scope_denied；runAllowlist=[]，mock业务调用数0。更宽专家/请求没有恢复被禁止能力。
3. **本轮派生no-tools对照**：surface收到no-tools但declared权限允许calculate。records=0、强制调用unknown_tool、mock调用数0；保存的declared runAllowlist仍为calculate。这正是避免规划态永久污染后续权限的已有设计。

独立实际执行：

```text
node -r ./scripts/register-ts.js --test tests/agent-execution-intent.test.js tests/tool-surface-governance.test.js tests/agent-capability-scope.test.js tests/agent-capability-intent.test.js
72 tests / 72 pass / 0 fail / 0 skip / exit 0
```

涵盖空allowlist/denylist在minimal、v1、legacy的广告与派发一致；权限交集与撤销；规划/讨论无工具；显式requiredTools/read evidence仍严格；正式契约不因原文URL/关键词增加义务；普通chat快捷保持。resolver外层tests0不重复计数。未做完整runtime→最终HTTP body的新增集成，所以不把分段证据描述成全新端到端scope认证。

## 后续最小通用方案与冻结验证办法（设计，未实施）

1. **独立的宿主限制字段，而非重用session.executionPolicy。** 明确task级或revision/attempt级范围、来源、确认版本与task/session/run绑定；宿主在确认动作中冻结，正常模式切换只重算派生policy，不创造/删除硬限制。旧记录未声明保持兼容；不能靠模型参数、SOP、引用材料或否定正则生成/扩大授权。用户自由文本未映射到结构化确认时，不得UI声称已获得硬禁工具保证。
2. **限制只收窄。** 有效能力是组织/专家/已有ACL/父运行/本轮宿主限制的交集；任务新scope不得覆盖专家拒绝或开放工具。借用现有empty allowlist等执行守卫，但不要把一次修订限制无条件合并为永久session.run权限；临时限制到期/新确认与旧grant失效规则需显式定义。
3. **接线必须从预检前开始。** runtime目前在generate前执行Skill/connector preflight（:475–478），prepare又在最终policy计算前装配上下文（:484）。若本轮承诺完全不调用外部能力，scope需先约束这些宿主动作及自动检索，再贯穿L0/L1选择、工具广告、动态发现、dispatch、child、finalize/retry。静态必需方法是否可本地装配应明说；不能为了“无tools请求字段”暗中用等价检索绕过限制。
4. **冲突fail-closed，不降验收。** 专家requiredTools/真实artifact义务与本轮无工具相冲突时，在执行前明确要求确认合适交付路线/范围；既不自动执行也不抹除requiredEvidence伪装完成。此变化需由主线独立设计/impact，不建议本轮叠加提示词解决。

冻结验证应先固定输入、专家快照、scope版本及run绑定，再用mock模型主动发出grep_files/list_skills/load_skill/calculate/connector调用；记录最终请求无工具定义、派发handler进入次数0、executionStarted=false。覆盖：宽专家不能覆盖窄scope；同任务revision/reopen/retry仍保留本轮限制；跨task/run及过期scope不复用；旧planning no-tools后经正常确认执行可恢复许可；quoted禁令/模型args不能更改scope；requiredTools冲突不执行也不验收。宿主预检/自动检索须单独计数，不能只数模型tools；提供足额静态给定材料与模型预算不足两种对照。此为后续验证计划，不是已实现测试。

影响横跨task存储/API、runtime预检和revision、prepare、scope/surface及Executor/子运行，不能称单行LOW修复。本次GitNexus query因FTS降级为空；context找到buildRunToolSurface的executeAgentGenerate来路，但标lower-bound、没有process返回，使用源码补查，未重建索引。未修改符号，未新跑impact；上述为设计影响范围，不冒充索引量化安全结论。

## 当前磁盘/证据 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/expert-task-runtime.ts | d7481c56206bf765121541b6046baadb93f1676dbc7a4805cbb0a39ef5c08bda |
| src/lib/agent-generate-prepare.ts | 6f4755e799b2ae4ca59b1812128ce340efb8cd4df642f7f14debdfc9e9b8f9aa |
| src/lib/agent-generate-tool-surface.ts | bcb63d9d6ffa65b1dee5257635d77e6dffc3936b17ff46c6edc6b2248d7c8582 |
| src/lib/tool-surface-builder.ts | 5ab0152edad3b0d26869d560e73e5685c5c4bae776663319b8bbc211a7b8f446 |
| src/lib/agent-generate-execute.ts | ef1a2f021fc5d395518f0a273a721acb76f934edff14e9600b34dc18590d0dde |
| src/lib/agent-run-kernel-adapter.ts | 365c148c17fed946c3ced093257d12a41f975065b57d67c43cc791bfb679709a |
| src/lib/agent-run-executor/phases-model-tool.ts | c80c4958a8a2cf253c84d76809fec2506b70544bf7ed1b7f2e9261f0d31a17f3 |
| src/lib/context-engine/policy.ts | 461b61397640f0442910b5f6f921e2a41ef1f55229d60a7b3b2b31fb2eb28ddc |
| src/lib/agent-capability-scope.ts | 8795d7f78124fdc5f7b24b00bbe6d263850b7334b8cb3088fe79424f368e3cee |
| evidence/rqa28-vd-d01-actual.json | fe0bef93b0eccf64e2f43c4ad05c1b86f4071ba9e77d11e2ba2747415a6bf5bb |
| evidence/rqa28-d01-case-and-ui.json | 1bc9a5db3aa4511b3d11c585a3b2448c8bdc69bccad07b16b035d3c17fe05025 |

不据当前磁盘推定历史QA加载模块。本轮到此结束，无现有硬权限绕过的已复现实证，不启动额外运行。
