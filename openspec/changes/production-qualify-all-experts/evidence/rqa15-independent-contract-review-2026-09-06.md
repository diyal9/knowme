# RQA15 独立包/装配契约复审

2026-09-06。仅新增本报告，未改源码、方法、测试、catalog 或冻结案例，未调用模型/API、安装或 fullcheck。使用 skill-creator 区分工程装配与专业评测，使用 GitNexus debugging 查链；FTS 降级为空、resolveOutputSpec 未命中，结论以当前源码和本地定向检查为依据。

## 结果与真实红绿历史

本轮独立复跑：`node -r ./scripts/register-ts.js --test tests/rqa15-professional-method-contracts.test.js`，**22/22、exit0**。测试 SHA256：`AFC9BA728B1081CFE085DFCCD2BB9F0537817E863686E5C6C804E26580B315CE`。主线 fullcheck34404 exit0 属主线结果，本轮未重复。

最早实际红测是 **15 pass / 7 fail / 22 tests / exit1**，不是22全红，也不是完整旧安装基线：执行时作者正分批落地候选。SE失败3项（方法manifest/正文不存在及核心未装配），SA失败4项（legacy仍2.0.0，另三项同类方法缺失），UR七项已绿；共同快照/共享helper校验通过。其后只给新测试增加“连同标题的L1总长<2400”断言，没有放宽期望；候选齐备后22/22。最早红测发生在这条加严断言之前，不能把最终hash倒填为当时完整测试版本，也不能宣称做过完整旧包22项对照。

## 包与路由收尾

三专家 E/C/L/catalog 均2.1.0，核心分别为 software-change-verification、architecture-decision、research-evidence-analysis；旧helper分别 code-review、code-review、writing-polish，均optional。专家权限与pre-method-source逐对象相等：connector/tools allowlist为空，network/write/externalWrite=false。另人工检查三个新Skill manifest也均为同样受限权限、1.0.0。

每专家保留原两个默认成果的id/title/type/required，各声明核心requiredSkills；当前恰好一个无关键词的default route，仅声明该核心，不附加requiredTools/evidence/artifacts。resolveOutputSpec先选成果再与route并集：自定义单/多成果无需匹配默认id即可得到核心；用户id/title/type及其额外方法在测试矩阵中保留，accepted跳过、changes_requested优先选择均有断言。不是把安装依赖全量灌入任务。

## 是否会假阳性：发现一项确定漏检，不作全覆盖声明

在内存中执行原测试函数，仅替换指定模块返回值/文件读取视图；未写磁盘源码或测试。对照同样22项全绿。

| 内存故障注入 | 结果 | 含义 |
|---|---|---|
| resolveOutputSpec清空requiredSkills | 7过/15失败 | 能识别方法声明丢失 |
| 选中成果id/title/type被覆盖 | 10过/12失败 | 能识别身份覆盖 |
| 装配结果移除L1正文及对应block | 16过/6失败 | 不是只检技能名称或resolved列表 |
| 新Skill manifest读取视图中network改true（含Skill runtime的fsImpl） | **22过/0失败** | **新Skill权限尚未逐项锁定，确定漏检** |

第四项不代表当前包真的越权，也不证明运行时会授予该权限；它证明“22绿=所有包权限回归都覆盖”不成立。最小后续测试补强是锁定三个新Skill的permissions（以及禁止额外能力依赖），本轮依授权不修改测试。当前安全值已由源码复核确认。

其余必须保留的覆盖边界：

- 使用真实parseExpertFrontmatter、createExpertRuntime、profile、createSkillRuntime与assembleCapabilityContext，但从源码catalog读取live persona，并未执行安装/升级、持久快照、expert-task-runtime→prepare→最终上下文编译→模型请求的全链。尤其不能用它证明隔离安装包已更新、preflight处理disabled/missing正确或同run完整L1真正到达模型。
- user-extra-a/b仅检查契约并集，不证明任意额外方法已安装/可加载；另有显式helper与核心共同resolved用例，但未完整覆盖多方法预算裁剪。默认“不加载optional”准确含义是“不强制读入optional的L1”，不排除L0自动摘要。
- 核心正文与真实解析body相等、非空且<2400，完整进入L1 block，block连标题<2400且无截断标记；可识别示例性截断，但不证明方法内容正确或后续编译无裁剪。极短而无专业价值的正文仍可能通过。
- 三个随机不透明expert id克隆验证所测profile/装配路径不依赖原expert id；保留了方法id和persona内容，有限样本不是全仓不存在任何名称/ID分支的形式证明。
- 自定义id指与包默认id不相同的用户成果。若用户主动使用output-1等既有id，当前通用合并允许包同名契约覆盖title/type；22项未承诺改变该旧语义。全成果已accepted、悬空changes_requested、多修订历史、普通chat等亦非本套覆盖范围。

## 数据曝光与专业评分边界

测试进程确实读取了新Skill原始body、执行解析/加载并比较内容，不得称“未读数据”。冻结留出题时，设计者没有阅读这些新SKILL.md正文来构题，但已知道候选名称、设计方向和装配结果；本次收尾已阅读方法内容。SA-H02由本评审者设计，后续评分必须标注设计者、非盲，不称完全独立验题。

四个SA（N01/H02旧/新）主线报告均MODEL length→FINALIZE length、无提交正文，**专业N/A，不填0/5，不把平台拒绝文当专业原答**。本轮已核对保存的rqa15-old-live、rqa15-new-live、rqa15-holdout-old-live中对应SA失败记录与空deliverables；新SA-H02待相应文件版本定位。原始失败不得覆盖，早先其它批次的SA评分也不能移用。

下一步仅只读定位修复预算及UR-H02平台替换链；22绿、模型stop、task review均不是专业通过证据。

## 追加：主线新增权限回归后的独立变异复核

2026-09-06，保留以上22项及15/7历史，不回写旧结果。主线只新增权限/dependencies断言；本评审未修改测试或生产文件。当前测试SHA256为 `F9586D0F47FEB14F620045A677BA47879A4D8159397DA144DF9563162439A232`。

独立正常读取运行：**23 pass / 0 fail / exit0**。用独立Node进程、`-r ./scripts/register-ts.js`运行原测试，在内存中包装`fs.readFileSync`，仅对指定新Skill的`capability.manifest.json`读取结果将`permissions.network`改为true，文件不落盘：

| 单独变异对象 | 结果 | 实际失败断言 |
|---|---|---|
| software-change-verification | 22过/1失败，exit1 | professional method must not widen authority |
| architecture-decision | 22过/1失败，exit1 | 同上，错误信息指向architecture-decision |
| research-evidence-analysis | 22过/1失败，exit1 | 同上，错误信息指向research-evidence-analysis |

另有一次三者同时变异，亦22过/1失败，断言在首个SE对象即失败；因此追加上述逐个变异，排除只覆盖循环第一项的假象。均命中新增`RQA15 core methods declare no extra authority or capability dependencies`，原22项仍通过。**此前已复现的network漏检已由新增测试封闭**；未声称穷举所有权限/dependencies故障，亦不把23绿升级为专业合格或实际安装全链证明。本轮未跑fullcheck。

新SA-H02保存文件现已核对：`task-mtp2li38-xgh19` / `expert_task-mtp2li38-xgh19_mtp2like`，同样MODEL length→FINALIZE length、failed、deliverables=[]，补齐上文待定位记录，专业仍N/A。运行时诊断另见`rqa15-runtime-followup-diagnosis-2026-09-06.md`；UR-H02候选是任务层needs_input，不是review/误验收。
