# RQA30 — 材料提交完整性与剩余专家能力审查

## 本轮结论

上一目标轮 RQA29 属实质进展；本轮继续修复共享材料链路并取得独立专业包/权限证据。24 专家生产目标仍 ACTIVE。本轮没有真实模型、QA/profile、联网、付费生成、安装或外部写入；没有新增专家资格。RQA28 F01 真实修订仅改版本标题的专业失败仍有效，D01 仍是缺少完整反馈的无效诊断，D02 审核拒绝未重试或绕过。

## 材料链路已修

1. `task-text-contract.ts` 增加原始 materials/brief.materials 验证：新写最多32项，每项正文/别名最多8000（trim后UTF-16长度）；非法类型、超限明确拒绝整次提交。不通过截短来制造合法材料。旧字符串标题引用保留兼容，不当作正文证据。
2. `workbench-task-store.ts` 读取/规范化材料不再裁掉正文或第33项以后的已有记录；create/update复用写前验证。review先验证原始材料，追加原批后由update检查累计数量；失败时意见、状态、材料与事件不部分落盘。
3. 进一步穿过真实runtime review入口，发现它原先在store前执行slice(0,3)、正文text(8000)及filter，无效附件可消失而意见单独提交。现reviewMaterials返回显式结果，保留既有每次3附件限制但超限整批拒绝，复用validateExpertTaskInput进行类型/正文/图片格式/引用校验。只有完整合法材料进入store；拒绝返回started=false且不启动execute。
4. 合法ref-only原先被丢弃，现在保留；ref不是已读取正文，未提升为事实、工具回执或权限。图片仅复用原接纳校验，不声称本轮新增图片字节验真或视觉质量验证。

## 红测、独立复核与全量检查

- 新文件 `tests/rqa30-material-admission.test.js`：首13项在旧源1过12失败；store修复后相关103项绿。随后6项runtime红测全部失败，补齐入口后当前19项及相关回归通过。
- 独立审查首70绿仍发现runtime四个真实store探针的数据丢失；这些不是被绿色套件覆盖的通过项。最终109/109、exit0并复跑六个临时落盘探针，确认已列P1残余关闭。见 `rqa30-material-admission-review.md` 追加关闭节，保留旧发现。
- 拒绝探针验证原始文件、意见、状态不变，零store.review调用或累计校验拒绝；合法三附件验证8000字末尾标记、ref-only与另一份正文保存及JSON重开。生成接口为mock/停止接缝，不冒充模型、渲染UI或真实专业任务。
- 中间 `npm run check` session89310：后端3359通过、51跳过、1失败，失败为capability-pack legacy scene-only安装；单独原测试文件22/22重跑通过。原因未确定，未修改无关代码掩盖，保留为待观察测试稳定性问题。
- 最终 `npm run check` session86843 exit0：后端3366通过、51跳过、0失败；renderer86文件606通过；lint和renderer typecheck通过。最终检查在当前19项和runtime补丁之后启动，不用中间候选冒充最终证据。
- `git diff --check` exit0；仅共享windows-gpu-policy/fallback及对应测试的CRLF提示，不属于本轮编辑。未提交或重置。

## 专业审查：不是简单堆Skill

独立报告 `rqa30-unbaselined-experts-review.md` 按冻结rubric审查四位当前源包和直接方法，记录47份hash，无实测评分：

- office-partner已有四条具体办公路线，但离线草拟承诺与一律真实飞书读取有冲突；固定发送前清单也并非所有任务需要。
- external-capability-importer已有预览/规划/确认/导入/验证SOP；当前verify只确认引用存在、启用，不证明连接器运行或制品专业合格。不能把这个有限合同误记为工具故障，也不能扩大成功含义。
- artbundle-expert已有切片、Label、Creator等工业方法；仍有阶段依赖、Label例外、roundtrip与真实渲染证据边界问题。
- ui-expert已有路由和定向修改方法；数量约束、参考编辑降级、入口依赖及同名Skill不同合同存在冲突。

两个自定义专家源在外部th-art仓库，无对应KnowMe内置包，不是漏发内置专家。本轮只读源，不读当前APPDATA安装态、不覆盖外部资产。静态矛盾是待修/待验证的问题，不是模型专业失败或资格通过成绩。

## 权限复审与剩余边界

`rqa30-execution-scope-review.md` 独立72项离线测试及探针未击穿现有明确空allowlist交集；未证明专家宽权限覆盖了宿主硬限制。session.executionPolicy是每轮派生状态，不能永久锁住旧规划no-tools。正式任务尚未接通独立、可冻结的本轮禁工具限制；自然语言、空requiredTools、未支持的payload字段均不能当宿主禁工具保证。本轮未改权限源、不新增正则授权、不恢复D02。

材料限制仍是有限接纳，不是无限上下文：主输入note1000、修改每批3附件、材料总32/正文8000、provided-materials总UTF-8预算1MiB和模型预算保持；老超限材料可保留读取，但执行或携带完整brief更新仍可能明确拒绝。已截掉的历史尾部不能恢复。图片累计选择、其他入口预处理、计划条目上限、正式执行后24000字输出处理及完整UI行为尚未全审，不能称全部内容协议已完成。

GitNexus调试/影响分析约束了此次共享修改：normalizeMaterials LOW、runtime reviewMaterials/reviewDeliverable LOW；store.review及新增validator图谱UNKNOWN，已人工核对runtime/IPC动态调用和create/update/createStart消费，不把无边当安全。query FTS降级且资源列表仅repos/setup，未假称取得完整process资源或联网修索引。最终整树detect_changes为323文件、707符号、172流程、CRITICAL，含共享历史修改，不是本轮范围全审。

下一步优先把办公材料模式和专家条件依赖冲突落实到通用契约，再进行冻结场景的正常/异常/修改验证；真实诊断需明确测试授权边界。仍需全部24位的实际专业交付、SOP、真实异常恢复、上下文/知识/飞书适用性及UI验收，不以本文或工程绿测勾选完成。

## 最终源码 SHA-256

- task-text-contract.ts：`57ad56c91dafdb00832439c6c764ecf1cb88442dd3694758e1d243bcdcf2a3fb`
- workbench-task-store.ts：`cc4f6e265cd7e42777101f05f48cd6a2dc1d84cdfb23ac2e3679d5236d536e78`
- expert-task-runtime.ts：`0411b455b289e1ab2b83b9569248f6e5b120a7e1e46ec680422d78f2daf5cc16`
- rqa30-material-admission.test.js：`e3a029a2026c08dc2723450a4e49e7b49914235651adcb8fba83684c234a8581`
