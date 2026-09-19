# RQA19 三专家当前包只读审查

2026-09-06。仅源码包/通用装配契约与已有安装审计复核，**不是actual-installed基线或专业评分**。未读写APPDATA、未访问QA或调用模型；只新增本报告。主线负责当前隔离QA的真实案例和安装/run绑定。

## 当前方法与装配缺口

三专家E/C/L均2.0.0；canonical为schema3，execution均`sop-first`、两份独立required answer交付，无routes、无交付级requiredSkills/requiredTools。connectors/tools列表为空，network/write/externalWrite均false；这不是发布、投放、生图或访问任意文件的授权。

| 专家 | 当前SOP与有效绑定 | 预期方法加载及专业风险（风险不是已发生的模型失败） |
| --- | --- | --- |
| content-strategist | SOP239字符：目标/受众行为→素材证据→3–5支柱→排期/复用→指标；E/C/L一致绑定writing-polish，C依赖required=true。 | 有策略骨架但仅绑定168字符润色方法，不能替代受众证据到渠道、产能分配和指标口径的专业判法。风险：支柱/标题齐全却没有素材支撑与可执行节奏，把愿望当受众事实或预期效果；润色Skill的“完整润色版+改动说明”可能偏离策略委托。不能因依赖required就声称正文必达L1。 |
| creative-director | SOP261字符：命题→差异方向→推荐取舍→Brief→品牌/版权/小图检查；E/C/L一致绑定writing-polish、visual-brief-prompt，两依赖均required。 | 有概念与下游交接骨架，但缺如何判定概念实质差异、如何以受众/媒介证据淘汰方向的具体过程。风险：换配色代替概念、暗示超出已证实卖点、只宣称可读而不检查。visual-brief-prompt强制完整生图交接包及盘古参数，若加载可能把上游概念评审过早变成下游参数填表；其SKILL=2.0.0、C=1.0.0的版本分裂仍在。 |
| data-analyst | SOP243字符：分析单位/口径→质量→筛选聚合计算→竞争解释→复现与限制；**E无skills、C dependencies=[]，只有L列metrics/cause**。 | 只读loadExpert实际返回skills=[]，不能把legacy方法当有效加载。风险：冲突主键随意去重、把缺金额当0或把完整样本均值外推全部订单、混合分母/观察窗、不可复算数字及越界因果。现有metrics/cause 1.1.0已提供更细的分母、加权/分解、实验、反证与纠正方法，但本包未绑定；且业务指标方法仍不等于任意数据文件清洗/统计能力。 |

### “应该能用”与“本轮必加载”分开

`src/lib/expert-runtime.ts:306`加载E并优先规范化C；legacy manifest另存，不覆盖E的skills。`expert-execution-profile.ts:62/81/110`依据交付/route形成outputSpec；三包无方法route，**默认output-1与自定义primary answer实测requiredSkills均[]**。未改变两个交付的id/title或合并它们。

`expert-task-runtime.ts:583`以outputSpec.requiredSkills传skillRefs；`agent-context-assembly.ts:206/218/238/242`限制绑定集合、自动匹配只形成L0，显式refs才加载L1。因此：content/creative的辅助Skill可在绑定范围内被匹配或按授权路径显式读取，但当前包未保证其全文进入本轮；data两business方法连有效绑定都没有。实际工具自选/其他refs是否补入、安装Skill是否存在，须以**当前同run context audit**确认，不在这里断言所有运行必定无方法。

若将来调整包，最小方向是明确各角色核心方法、同步E/C/L，并在已消费default route/交付requiredSkills中绑定；辅助润色与生图交接按阶段使用。不应由平台按专家ID硬编码专业判断，也不能为本题追写答案。本轮不实施。

## 安装证据边界

已有`../expert-rubrics.md`（2026-09-05，L24–26、L294–295、L382起）记录历史主profile安装包同为2.0.0却缺新版SOP，content/creative安装C无execution；data安装C/L没有两business方法；visual-brief-prompt当时安装正文1.0。当前源码仍能确认上述data声明分裂和visual版本分裂，但历史安装审计**不证明当前隔离QA仍是那份包**。本轮只读该报告，未回访其APPDATA路径。

主线真实基线需保存每例task/run、actual-installed E/C/L与Skill版本/hash、assignmentSnapshot、最终方法正文装配与完整输出；若安装与下表不同，应按实际安装评分，不从源码补方法或称新旧A/B。这里没有断言三专家已生产合格。

## 当前契约测试与fallback

GitNexus query因FTS降级返回空；resolveOutputSpec context给出lower-bound旧位置，未用其作为当前调用链证明。fallback是直接阅读上述函数及测试，未改符号、不做影响范围安全认证。

执行：`node -r ./scripts/register-ts.js --test --test-name-pattern="keeps every bundled expert structurally|gives every bundled expert a valid" tests/expert-catalog-contracts.test.js`，**2项通过、0失败、exit0**。只选不创建snapshot的结构项，未跑安装/会话落盘项。另以仅提供existsSync/readFileSync的fsImpl调用当前loadExpert，再用resolveOutputSpec核对三包默认/自定义交付，均正常，结果如上；未创建会话快照。

测试盲区：SOP+已声明方法正文≥220即可通过；三包仅SOP已过阈值。全量结构项不要求每包必须有专业核心方法，也未对这三包统一校验E/C/L Skill一致、辅助Skill正文与C版本一致、同run L1实际加载，更不检验专业结论。这解释了**结构绿与明确声明缺口可以并存**。

## 当前精确路径、版本与SHA256

下列相对路径统一相对于绝对根`D:/aispace/knowme/`；E=`EXPERT.md`、C=`capability.manifest.json`、L=`manifest.json`、S=`SKILL.md`。每行展开后是唯一文件，不是安装包hash或合成agentHash。

| 目录/文件 | 版本 | SHA256 |
| --- | --- | --- |
| src/catalog/experts/content-strategist/E | 2.0.0 | `40b2897ce05620135c99954d77a04fa7ae5b0ccdd630022ab9ecc2b375c03d3b` |
| src/catalog/experts/content-strategist/C | 2.0.0 | `ed8dc15799a05edec7d72d40c172790cd1bcf3bc3c1a9205d46c3a4f3b4280c2` |
| src/catalog/experts/content-strategist/L | 2.0.0 | `459bc2392aab8057b36330ad645a10fcbeab052c835211e94c5f3ac58d6152c2` |
| src/catalog/experts/creative-director/E | 2.0.0 | `6af96ca88ee3d6d80c8cbd3e52c0434e609246cebf8b078ff3fcdf9570a73de8` |
| src/catalog/experts/creative-director/C | 2.0.0 | `044d8127ca3e4f16ef2da973b2bdc0e2751a796e13693558df808e633f22f36b` |
| src/catalog/experts/creative-director/L | 2.0.0 | `a533a003279617802bcc51236edf5a440a1d495f7ed362bb936b300c7ad839b8` |
| src/catalog/experts/data-analyst/E | 2.0.0 | `0788d99cd7fae15e9ac45cd30c1f1f478078a71ee4a525621e13bc2d14593a51` |
| src/catalog/experts/data-analyst/C | 2.0.0 | `1b29bc06199cbc043bf52eabee7ad209bdc8e3cd9364fbdf0eb72f8e059ca3bb` |
| src/catalog/experts/data-analyst/L | 2.0.0 | `d4d097128453d9aad80916966741f01daf2712eb3361a5397854c527616ddc56` |
| src/catalog/skills/writing-polish/S | 1.0.0 | `1186da38fb069bbb33c9e4256f99063edf004e3f5d02c753eff84c1ec2e034a0` |
| src/catalog/skills/writing-polish/C | 1.0.0 | `17b769e39bdb1bdca5818cb8067b5f0186a7f81f1292052e21d069a45761ab25` |
| src/catalog/skills/visual-brief-prompt/S | 2.0.0 | `d843aefc1aabd83560f5a6fda524c56ce8258884463020f6e2d169f588874a58` |
| src/catalog/skills/visual-brief-prompt/C | 1.0.0 | `847cfa9be340e8ba2d258c29048b66b08c9e7d5a4d707422f0349b85d9bef8b6` |
| src/catalog/skills/business-metrics-analysis/S | 1.1.0 | `3ef3e084c6c28bded806a70992559e6c0870cbb2ae8c47bc4350797415770c76` |
| src/catalog/skills/business-metrics-analysis/C | 1.1.0 | `a7114ffb2b6bc050aa52b50ea604b58824f66fcb536f8e2c3a18d19ea0e72685` |
| src/catalog/skills/business-cause-analysis/S | 1.1.0 | `7c682168641059e6bc4fce450e7923ddddbb53c895dda6cc0a3c19439007f736` |
| src/catalog/skills/business-cause-analysis/C | 1.1.0 | `78c169533a8b1c3b5cd0c88059774e51121192fe44c592311626636008b51b92` |

审计报告SHA256：`expert-rubrics.md`=`7385963d1f94874f904733053780705f5b43a1f23d1baa34c5019cef20b56b12`；本次读取的`tests/expert-catalog-contracts.test.js`=`1b7e4736b599de0ca90f0f00914ea2155c8219f5956384221b1a442d8d305d8f`。Skill去frontmatter正文字符数依次为writing168、visual530、metrics1565、cause1122；不是装配完成或模型有效使用证据。
