# RQA30 材料接纳候选独立复审

2026-09-06；只读源码、离线测试及临时store探针。未改源码/测试，未访问QA/profile、真实模型/网络、安装或fullcheck。主线提供的13项旧源1过12失败为主线记录，本轮未独立重跑旧源。

## 结论

**store层候选通过；正式runtime review入口仍存在可复现的静默数据丢失，阻断“材料完整性全链路已关闭”的结论（P1残余，不是本补丁新引入）。** 新增13项及相关测试共70/70通过，但均未覆盖review附件在runtime内预裁剪/转型后才进入store校验的反例。

### P1：runtime把非法或过量raw附件先变成合法子集，绕过新接纳校验

位置：`src/lib/expert-task-runtime.ts:128–145` 的reviewMaterials，以及`:1123–1127` 的reviewDeliverable调用点。

- `.slice(0,3)`在store看到材料前丢弃第四项及以后。
- `text(item.text || item.content,8000)`先裁正文并将对象转字符串。
- 非数组当空数组、空/非法项被filter丢掉，仍可提交其余评论/材料。
- store新校验的确运行，但它收到的已经不是用户原批数据。不能靠store原子性推断整个真实API原子接纳。

独立实际离线运行真实 `runtime.reviewDeliverable → store.reviewDeliverable → store.update → JSON`，结果如下。每例原任务一份primary待审交付物，comment=`不得单独提交这条评论`：

| 输入attachments | 实际返回 | 实际落盘 | 完整性结果 |
|---|---|---|---|
| `[{kind:'text',name:'note',text:'材'.repeat(8000)+'X'}]` | ok=true, started=true | 1项，正文8000，尾X丢失，comment已提交 | 应整批拒绝的8001字被接纳为前缀 |
| 四项合法短正文SOURCE0…SOURCE3 | ok=true, started=true | 仅前三项，comment已提交 | 第四项静默丢弃 |
| `[{kind:'text',name:'note',text:{instruction:'untrusted'}}]` | ok=true, started=true | 正文`[object Object]`，comment已提交 | 非文本未被raw校验拒绝 |
| `{text:'not-array'}` | ok=true, started=true | 0材料，comment已提交 | 非列表被降为空批后单独提交评论 |

四例JSON字节均变化。探针内“应拒绝且文件不变”的断言四例均红，统计输出`desiredAssertionsRed:4, probeCount:4`；为了展示全部反例，脚本捕获断言并打印结果，因此脚本exit0不表示上述契约通过。第四附件若采用通用32项上限，应完整接纳4项；若产品保留review最多3项，应明确整批拒绝。探针按后者检验，但无论选哪种语义，当前成功只存3项都不满足完整性。

安全隔离：通过生产createStore在系统临时目录`knowme-rqa30-review-probe-*`创建合成任务。仅在runtime启动后的store.get seam返回失败，阻止execute进入settings/session/服务；没有替换review转换、store校验或持久化。观察到started=true是同步API返回，不声称发生模型执行。临时目录经父路径与前缀验证后删除；未写诊断脚本或既有测试文件。

最小建议：在runtime review入口对原始attachments作列表/项/正文类型、长度及明确数量的整批校验，发生在转换、filter及任何任务写入之前；转换只保留合法完整正文，不用裁切制造合法值。映射为materials后继续复用store累计数量检查；无效时评论、附件、验收状态、事件均不提交、不启动execute。普通reference/title材料与图片校验维持各自原契约，不将“所有image必须text”或新的图片规则塞入此修复。无需模型试验或提示词修改。

## store层确认及兼容边界

- `task-text-contract.ts:24–37` 同时检查顶层materials与brief.materials；新写超过32项、非数组、非字符串/对象的项、数组项被拒绝；content/text两个别名分别检查类型和8000上限，不因一个有效别名遮掉另一非法值。legacy字符串title项继续允许；普通ref无正文不要求假造text。
- `workbench-task-store.ts:105–122` normalizeMaterials不再slice数组，不再裁content；仍trim正文、保留既有id/title/ref规范化和图片判断。这是保存已存文本/数量，不是图片验真或声明原字节从未变化。
- store create/update的写前验证覆盖混合patch；`:577–581` review先校验raw materials，再构建新评论/状态；`:612–619` 追加raw到旧材料后，由update校验累计数量，失败不落盘。实际测试验证无创建文件、拒绝前后JSON完全一致，不只是返回码。
- 8000字边界通过review→普通状态更新→冷重开→providedMaterials snapshot保持尾标；历史33项/8001字正文normalize保留，但快照32项门禁仍拒绝。不能把“可重开”声称为“任意旧超限数据可无条件执行或整体重存”：携带完整brief的后续patch仍可能被写上限拒绝。
- 独立纯函数兼容控制通过：legacy字符串标题、`{title,ref:'knowledge:guide'}`、`{name,resourceRef:'source:notes'}`、text别名尾标。前两类引用的content为空，未提升为事实正文证据。该兼容探针首次忘加repo preload，在任何断言前MODULE_NOT_FOUND；纠正命令后通过，不计生产失败或红测。
- expert-task-input和provided-materials hash与此前相同；note1000、图片校验及上下文1MiB门禁没有因这两文件补丁改动。本轮不扩大为图像协议或所有历史异常类型认证。

## 实际定向测试

```text
node -r ./scripts/register-ts.js --test tests/rqa30-material-admission.test.js tests/rqa29-task-text-integrity.test.js tests/workbench-task-store.test.js tests/expert-task-recovery-boundaries.test.js tests/rqa12-provided-materials-lifecycle.test.js tests/rqa12-provided-materials-dataflow.test.js
70 tests / 70 pass / 0 fail / 0 skip / exit 0
```

包含13项RQA30和9项RQA29；附加探针不并入70，resolver外层tests0不重复计数。四个runtime红例不能被这70绿掩盖。后续回归必须穿真实runtime.review入口，检查拒绝时文件/评论/状态不变及零执行；成功边界再检查完整尾标与累计数量，不只直调store。

按GitNexus debugging技能query/context：FTS降级query为空，context找到reviewMaterials的runtime.reviewDeliverable调用者，标lower-bound且无process返回；已用当前源码补查，未修索引。未修改符号；修复所需runtime symbol impact须由实施方执行，不能沿用store LOW宣称runtime风险已覆盖。

## 测试前后相同的当前 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/task-text-contract.ts | 57ad56c91dafdb00832439c6c764ecf1cb88442dd3694758e1d243bcdcf2a3fb |
| src/lib/workbench-task-store.ts | cc4f6e265cd7e42777101f05f48cd6a2dc1d84cdfb23ac2e3679d5236d536e78 |
| src/lib/expert-task-runtime.ts | d7481c56206bf765121541b6046baadb93f1676dbc7a4805cbb0a39ef5c08bda |
| tests/rqa30-material-admission.test.js | 93bbefd6920be0c80c140413f2438c1677fad3eec80f27695de3e4337b810973 |

另核对未改边界：expert-task-input=`b86a500ed2b83054393aa4cfd6eef436759e13530f29d824539362bbe407b8f3`；provided-materials=`a7c9842b41387a3e47eb2e2da5f4af46806a73cdb62246ea96328ddc006c14f7`。本报告仅本轮观察，不等同加载QA进程/全库冻结。

## 追加：runtime扩展补丁关闭复核（2026-09-06）

**此前四个runtime预裁剪红例均已独立重放转绿；本报告所列P1残余关闭。本次限定复核未发现新增阻断项。当前19项RQA30及相关测试实际109/109通过，exit 0。** 上方旧候选结论保留为历史，不覆盖红例。主线的首13项旧源1绿12红、后6项旧runtime6红为主线测试记录；中间fullcheck89310不计为最终验证，本评审未跑fullcheck。

### 最新三个源文件复核

- task-text-contract与workbench-task-store均保持前次hash：store原始材料新写8000/32限制、整批与累计原子拒绝、读取历史正文/全部项不裁切仍成立。
- `expert-task-runtime.ts:128–137` reviewMaterials现在返回结果对象：超过3项明确拒绝；其余复用validateExpertTaskInput，在任何映射前检查整批列表、正文类型/长度、可读引用及既有图片格式要求。合法映射只生成id/title，正文使用validated材料，不再slice正文/数组或filter掉失败项。
- `expert-task-runtime.ts:1104–1122` changes_requested先检查结果，失败返回started=false，发生在store.review之前。成功才将validated materials交给真实store检查累计数量；原accept不摄入修改附件的流程保持不变。
- review仍最多3附件，普通task材料最多32；合法ref-only在readable ref路径保留。普通store的legacy字符串标题仍兼容，但runtime上传附件要求对象且具正文或可读引用，两者不是同一输入协议。未扩宽到title-only附件可作为事实材料。
- validateExpertTaskInput、provided-materials文件hash均未变；本次是review复用已有输入验证，不是修改图片解码/真实性校验、note1000或1MiB材料快照门禁。仍不声称所有历史异常值/别名组合与所有上游输入问题已清零。

### 实际命令和结果

```text
node -r ./scripts/register-ts.js --test tests/rqa30-material-admission.test.js tests/rqa29-task-text-integrity.test.js tests/workbench-task-store.test.js tests/expert-task-recovery-boundaries.test.js tests/expert-task-runtime.test.js tests/rqa12-provided-materials-lifecycle.test.js tests/rqa12-provided-materials-dataflow.test.js
109 tests / suites 2 / pass 109 / fail 0 / cancelled 0 / skipped 0 / exit 0
```

当前19项包括5个runtime非法整批拒绝用例与1个三份合法附件透传用例；相关回归包括placeholder回填、长目标读取零写回、旧版与反馈保留、材料快照身份/证据边界等。外层resolver的tests0不重复计数。

独立另做6个离线探针（不计入109）：真实runtime.review→真实store→临时JSON，不改源码测试；沿用前次四种原始输入，检查返回与文件字节。

| 控制 | 当前观察 |
|---|---|
| 8001字正文 | ok=false，started=false，store.review调用0，文件不变 |
| 4份合法短附件 | ok=false，started=false，store.review调用0，文件不变；明确3份上限 |
| 对象正文 | ok=false，started=false，store.review调用0，文件不变，不再保存[object Object] |
| 非数组attachments | ok=false，started=false，store.review调用0，文件不变 |
| 已有32材料+1合法新附件 | store.review调用1，由累计校验拒绝；ok=false，started=false，文件不变 |
| 合法3份：8000字尾标+ref-only+短正文 | runtime返回ok=true；store与JSON重开均3份，完整MATERIAL_END及artifact:reference-id保留 |

合法成功探针只在启动execute后的store.get seam返回失败以停止后续服务；不会调用settings/profile/模型。拒绝探针无需该截停。临时目录经父目录及前缀验证后已删除；只持久追加本报告。

### 测试前后相同的当前 SHA256

| 文件 | SHA256 |
|---|---|
| src/lib/task-text-contract.ts | 57ad56c91dafdb00832439c6c764ecf1cb88442dd3694758e1d243bcdcf2a3fb |
| src/lib/workbench-task-store.ts | cc4f6e265cd7e42777101f05f48cd6a2dc1d84cdfb23ac2e3679d5236d536e78 |
| src/lib/expert-task-runtime.ts | 0411b455b289e1ab2b83b9569248f6e5b120a7e1e46ec680422d78f2daf5cc16 |
| tests/rqa30-material-admission.test.js | e3a029a2026c08dc2723450a4e49e7b49914235651adcb8fba83684c234a8581 |

此次impact LOW属于主线对reviewMaterials/reviewDeliverable的既有记录；本评审未修改符号。未QA、模型、网络、安装、源码/测试编辑或全量检查。结论仅关闭已列材料接纳缺陷，不扩展为专业资格或全系统认证。

## 最终收尾记录（2026-09-06）

**限定复审结论：已列材料预裁剪/部分提交缺陷关闭，无已确认的残余阻断项。** 独立实际运行仍为上述109/109定向测试（含当前19项材料测试）及6个离线探针；未另跑fullcheck，也未用此前72项scope测试替代材料证据。

主线最终通知：fullcheck **86843 exit 0**，backend **3366 pass / 51 skip / 0 fail**，renderer **86 files / 606 pass**，lint/typecheck passed。这是主线提供的最终全量结果，不冒称本评审独立执行。中间89310的capability-pack legacy scene-only installs失败及随后单文件22/22绿是历史记录，原因未确定；最终全量绿不构成该历史失败原因已查明的证明。

主线最终提供的runtime与19项测试hash，均与本评审测试前后实测一致：

- runtime：`0411b455b289e1ab2b83b9569248f6e5b120a7e1e46ec680422d78f2daf5cc16`
- tests/rqa30-material-admission.test.js：`e3a029a2026c08dc2723450a4e49e7b49914235651adcb8fba83684c234a8581`
- 本评审最后实测task-text-contract：`57ad56c91dafdb00832439c6c764ecf1cb88442dd3694758e1d243bcdcf2a3fb`
- 本评审最后实测workbench-task-store：`cc4f6e265cd7e42777101f05f48cd6a2dc1d84cdfb23ac2e3679d5236d536e78`

既有未覆盖边界与权限scope接口缺失仍按前文/独立scope报告限定，不视为本次材料修复新增阻断；不声称旧已丢数据恢复、任意历史超限材料可执行或真实模型专业合格。本轮收尾，无进一步源码搜索、运行或修改。
