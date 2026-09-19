# RQA21 citation/code 独立复审

日期：2026-09-06。范围仅本轮三个文件的 citation/field 增量；不将工作树历史改动归于本轮。未修改源码、测试或冻结证据，未操作 APPDATA、QA、UI、模型/API，未跑 fullcheck。本报告为唯一写入。

## 结论

独立组合回归 **169/169 pass，0 fail，0 skip，exit 0**，但本轮仍有 **P1：保留 Markdown emphasis 分隔符使原有字段/引用检查漏检**，不建议据此冻结为安全通过。两个有限反例均已即时通知主线：

1. 只加粗/斜体字段名，或拆分字段名，能够把无据负责人/日期变成 `fieldChecks=[]`，最终 gate 放行。
2. 加粗/斜体引用 ID 内文，能够把未注册引用变成 `ids=[]`，最终 gate 放行。

这不是自然语言语义检查的固有限制：相同文字在旧版能被识别并拦截，是本次投影变化造成的覆盖退化。169 个绿测未覆盖这些格式位置。

## 审查身份与增量证据

已读 AGENTS 和 gitnexus-debugging SKILL，按 query/context 导航。GitNexus 查询出现 FTS 降级且未给出可用 process；context 能显示 `markdownCitationProse` 的 `labelledClaims` / `explicitSourceIds` 调用关系，但不是完整安全证明。Fallback 为当前完整修改函数及调用方阅读、限定纯函数 probe、前后 SHA 绑定对照。未修改代码符号，无新增修改 impact；没有 commit。

用户说明已有 before snapshot。本次没有假称读取到其确切文件路径，而是将**仅本轮已知修改逆向还原于内存**，还原后完整文件 SHA256 与补丁前记录逐一相同，再用隔离 `vm` 加载比对。未写回源码、未改生产 `require.cache`。因此归因不依赖整工作树 `git diff`。

| 文件（均位于 src/lib） | 补丁前 SHA256 | 本次审查 SHA256 |
| --- | --- | --- |
| agent-source-citations.ts | `4e98fed766296028329cd88321b08e47420e81c48351a605dfed27c9a29de2c2` | `f241d44bd1d85be6bbf10a999545212f5a83a949af5c24f5f68192b490f137e1` |
| agent-claim-source-check.ts | `914b727aed3b651f59d7e86e8f2723c04e9497b69bb060576540ee107507fa69` | `de67c5c999ba44fe510b8bc4047b1ae8623f39d0ae6589bddcd695cac7885683` |
| agent-grounding-ledger.ts | `0892fd90596abe577df15baa962503ab493c447a481702f976c2a594a1e18e1d` | `47cfa41709027adcf1652de22b145995e24ccdfda2312d397c4bafa3d24697f1` |

三个源码和六个组合测试在测试前后 hash 稳定。以下行号属于上述审查版本；主线后续修复须重新绑定 hash。

## P1：emphasis 的原始分隔符泄漏进匹配投影

位置：

- `src/lib/agent-source-citations.ts:58`–66：遍历 em/strong 子节点时，额外输出其原始分隔符，且对 `includeCode:true` 同样生效。
- `src/lib/agent-claim-source-check.ts:28`–29：`labelledClaims` 在带分隔符的文本上先运行 `EXTERNAL_FACT_RE`；只有匹配到字段以后，才调用 `normalizeField`。因此其第14行的格式清除无法补救未匹配的字段。
- `src/lib/agent-source-citations.ts:86`–93：`explicitSourceIds` 在同一投影上匹配有限字母数字/标点 ID；`[**MISSING**]` 的星号使整个引用消失。
- `src/lib/agent-grounding-ledger.ts:423`–428：只能拒绝扫描出来的未知 ID，无法拒绝扫描阶段消失的引用。

### 触发与前后结果

唯一来源 `R1` 正文为 `负责人：李明。日期：2026-09-10。`，使用真实快照构造函数绑定合成 task/run。未添加执行证据。

| 候选原文 | 补丁前 | 当前补丁 |
| --- | --- | --- |
| `负责人：赵强。` | owner 字段 unresolved，拒绝 | 同左，拒绝 |
| `**负责人**：赵强。` | owner 字段 unresolved，拒绝 | fields 空，passed=true，gate.allowed=true |
| `*负责人*：赵强。` | owner 字段 unresolved，拒绝 | fields 空，passed=true，gate.allowed=true |
| `负责**人**：赵强。` | owner 字段 unresolved，拒绝 | fields 空，passed=true，gate.allowed=true |
| `**日期**：2099-12-31。` | date 字段 unresolved，拒绝 | fields 空，passed=true，gate.allowed=true |
| `负责人：**赵强**。` | — | 仍能识别并拒绝 |
| `**负责人：赵强。**` | — | 仍能识别并拒绝 |
| `材料[MISSING]。` | — | ids=[MISSING]，拒绝 |
| `材料[**MISSING**]。` | ids=[MISSING] | ids=[]，passed=true，gate.allowed=true |
| `材料[*MISSING*]。` | ids=[MISSING] | ids=[]，passed=true，gate.allowed=true |
| `**材料[MISSING]。**` | — | ids=[MISSING]，拒绝 |

字段行的补丁前后使用三个 hash 匹配的模块实际调用 `verifyClaims`；引用行的旧版另外直接验证了 hash 匹配的 `explicitSourceIds` 返回值。表中“—”表示未重复运行该旧版对照，不表示旧版通过。

### 当前版本可复算脚本

在仓库根 PowerShell 执行，不写文件、不访问网络：

```powershell
@'
const { explicitSourceIds } = require('./src/lib/agent-source-citations');
const { verifyClaims, applyOutputGate } = require('./src/lib/agent-grounding-ledger');
const { createProvidedMaterialsSnapshot } = require('./src/lib/provided-materials');
const providedMaterials = createProvidedMaterialsSnapshot({
  taskId: 'rqa21-review-task', runId: 'rqa21-review-run',
  materials: [{ id: 'R1', content: '负责人：李明。日期：2026-09-10。' }],
});
for (const text of [
  '负责人：赵强。', '**负责人**：赵强。', '*负责人*：赵强。',
  '负责**人**：赵强。', '**日期**：2099-12-31。',
  '材料[MISSING]。', '材料[**MISSING**]。', '材料[*MISSING*]。',
]) {
  const verification = verifyClaims({ text, providedMaterials });
  console.log(JSON.stringify({ text, ids: explicitSourceIds(text, ['R1']),
    fieldChecks: verification.fieldChecks, passed: verification.passed,
    gate: applyOutputGate({ text, verification, regenUsed: true }).allowed }));
}
'@ | node -r ./scripts/register-ts.js
```

期望：格式装饰不改变上述明确字段或未知引用的检查结果；全部拒绝。当前实际：除普通字段和普通引用两个 control 外，其余六条被放行。

### 最小修复方向（未实施）

需要区分**用于字段识别的可见文字**与**用于 ID 精确绑定的原始标点**，不能在两条路径一律保留或一律删除 emphasis。保住 `[____][___]` 的注册身份，同时恢复强调字段名、强调 ID 内文的旧有覆盖。引用解析仍须递归排除 code/link，字段路径仍须保留代码中的字段内容；不能以关闭字段检查、全局删下划线或将“已注册”视为事实支持来求绿。

至少将上表格式位置纳入主线回归。这里只建议修复边界，不宣称某个简单正则已足够实现。

## 已验证通过与仍有限的边界

- `knownSourceIds` 兼容默认空、数组及 Set；只有未注册且纯 `_.-` 的 token 被忽略。未知含字母/数字 ID 仍拒绝；注册的纯标点来源保持精确身份和局部来源绑定。
- `normalizeField` 先删除完整 bracket 再剥格式，修复下划线 ID 变成空 `[]` 污染字段值的问题；但不能解决上述匹配前的字段漏检。
- 两调用方已传各自来源 ID；来源“身份存在”没有直接改为内容支持，更没有升级为工具执行回执。
- 已有 wrong-source、未知引用、执行成功无回执、requiredTools、code/link/HTML 边界组合测试通过。额外小 control：强调容器内的 code `[MISSING]` 和 Markdown link 内的 `[MISSING]` 仍不冒充引用，容器外 `[R1]` 仍被识别。
- 不将有限字段核对描述为语义认证。未标记字段的自然语言、独立表头/单元格、来源 ID 冲突或材料自身真实性，不因本轮通过而得到新保证；本报告没有把这些既有限制归为本轮新增缺陷。

## 独立组合测试与 oracle 说明

```text
node -r ./scripts/register-ts.js --test --test-reporter=tap tests/rqa21-citation-placeholders.test.js tests/rqa18-citation-context-regressions.test.js tests/rqa18-claim-boundaries.test.js tests/rqa18-code-field-preservation.test.js tests/rqa18-html-local-scope.test.js tests/rqa18-source-citations-adversarial.test.js
```

实际：169 tests / 169 pass / 0 fail / 0 skip / exit 0。

| 测试 | SHA256 |
| --- | --- |
| rqa21-citation-placeholders.test.js（37条） | `86020442a8b28bba1d584b8109e616bfff8f9e73bf5d6f3caefeceeaf005a2c1` |
| rqa18-citation-context-regressions.test.js | `18214c231df3b95cc172ce1ccf69e21bb70dcbcc91f079b58857aaebf39a4391` |
| rqa18-claim-boundaries.test.js | `9c72c3781e165a37280f124c083f859d21c824d892b2a2d3de1e266100975a12` |
| rqa18-code-field-preservation.test.js | `a44c97d0b85e6c8982476be2deb807528982883f4e584b39b571f5430c655c13` |
| rqa18-html-local-scope.test.js | `87cbc9bfa6e8aa6c1ea6308ab12258a19fd533b7ec446d35d795d3a86c6edf88` |
| rqa18-source-citations-adversarial.test.js | `e7a52f3a982fbcf8455651a991498502c3b07f1fcc6db2b23281a9568f64e15b` |

主线已披露最初 footnote oracle 修正，以及最终红测阶段 18 pass / 19 fail；本次独立执行验证的是上表最终 hash，不声称自行重跑该历史红阶段。最终脚注测试把含空格说明和 `[MISSING]` 的定义行按现有 marked 可见正文检查，不宣称新增完整 footnote 语法。此次没有改 oracle 或冻结37条测试。

## 七项历史 fullcheck 失败：当前通过边界

已读取 `evidence/rqa20-check-28046.json`：历史 check exit1，backend 3068 total / 3010 pass / 7 fail / 51 skip。记录未保留全部失败的 actual/expected 原始输出；所载日志 SHA 为 `af5c4ce8df31e5d038a6f41d4296b69181f2ac2b7b4550f997ecd8ea90be3bb5`。不能从现在绿测倒推七项都来自同一运行时迁移。

本审查者独立执行的是下面**选中七项**，结果 7 pass / 0 fail / exit 0；不是整个四文件 53 项，也不是全仓 check：

```text
node -r ./scripts/register-ts.js --test --test-reporter=tap --test-name-pattern="runs knowme adapter offline|capability discovery matches|ordinary candidate selection still|RQA16 (budget|artifact|repeated) finalization|RQA16 repair after" tests/agent-benchmark.test.js tests/agent-capability-authorization-integration.test.js tests/agent-execution-intent.test.js tests/rqa16-production-repair-budget.test.js
```

| 历史失败 | 当前独立复跑 | 可证归因与限制 |
| --- | --- | --- |
| benchmark offline adapter | pass | 此前独立复现 4/10，六项实际 ERROR 对旧 DONE 期望；当前 core-10 已有五项拒绝类终态改为 ERROR，task-switch 仍期望 DONE，当前新任务清除旧 frame。不能把改变期望后的通过称为运行时自动恢复。 |
| capability discovery 中英/分页 | pass | 缺历史完整 actual/expected，当前可通过不证明唯一旧根因。 |
| ordinary candidate selection | pass | 同上，未修改测试求绿。 |
| RQA16 budget finalization | pass | 四项共用工具 fixture；历史末项明确记录工具选择 actual discover_tools / expected operation，不足以证明四项都是预算逻辑坏。 |
| RQA16 artifact finalization | pass | 同上；当前 fixture/文件不是历史 hash。 |
| RQA16 repeated finalization | pass | 同上。 |
| RQA16 repair after completed operation | pass | 历史尾部工具选择不一致可证；不能代替完整故障时序归因。 |

七项复跑时的测试/夹具绑定：

| 文件 | SHA256 |
| --- | --- |
| tests/agent-benchmark.test.js | `7918a37c3843c89e81128723df0c7a31e12dbfab213336653d8987bbc61fe215` |
| tests/agent-capability-authorization-integration.test.js | `a721ea7f1604d686cd42e5597782436cc3bb5340a3ae0cdc392c0ce795c6bc79` |
| tests/agent-execution-intent.test.js | `957909868b663138348d71304ce5e5c2946693562a46da27b69ed116538fcf11` |
| tests/rqa16-production-repair-budget.test.js | `a9161c1b520f44140c4c0d3b35e77762dda6e84d6bd48ef313bed56563b5f68e` |
| core-10 benchmark fixture | `451a9849a664a7aea0a7c2c89d48edc9f3e478c6b45dc5cc367a88cf8d365654` |

该次七项执行时 `phases-ground-persist.ts` SHA 为 `af8582a6d39d65b138016ca9a15cd4b614845a3cfa810523d8b03dfa32204098`；不是历史 check 的旧源码。部分文件为工作树新增，空 git diff 也不是未变更证明。未发现三个 RQA20 新方法包导致这些 harness 失败的证据：benchmark 直接使用 mock executor 路径，不执行专家 L1 方法装配。

当前七项通过只关闭“在该次文件状态下可复现同名失败”的说法；不覆盖 renderer、lint、typecheck，不证明任意真实模型/权限/调度场景安全。相邻报告如记录 53 项通过，属于其他执行者的结果，未与本次七项重复计数。

## 交接

本次测试文件未改，源码未改。需主线修复上面的同根 P1 并按新 hash 复验，不能用169绿替代这两个已经复现的安全边界。其余扩大语义认证/真实环境验收不在本轮范围。

## 追加：冻结24条与主线 emphasis 修补独立复验

2026-09-06，后续用户明确授权仅新增 `tests/rqa21-emphasis-regressions.test.js` 及本报告附录。上述历史发现与结论保留，不改写为已通过。

### 冻结文件与执行时序

- 新测试24条 SHA256：`cfd69994bb833a08be4ce1bad2c1edd060b24110c3f6de7b3a3101417ae81e8c`。
- 原37条 SHA256 仍为 `86020442a8b28bba1d584b8109e616bfff8f9e73bf5d6f3caefeceeaf005a2c1`，本审查者未编辑。
- 新文件包含六个已展示反例、四个真实支持正例、四个原有拒绝 control、四种排除上下文各两条（inline code/link、reference link、HTML code）、两个相邻纯标点 ID 的局部绑定 control。
- 正例不仅断言 passed，还断言恰有一个字段、具体 label/value、`source_excerpt` 及 sourceIds，防止漏检冒充正确通过。字段元数据的实际路径是 `verification.metadata.fieldChecks`；前文最小打印脚本的顶层 `verification.fieldChecks` 不能展示该元数据，新测试使用正确路径。
- **没有执行新测试的历史红阶段**：文件写入之后、首次执行之前，主线已经落地新的 `markdownCitationProse` 补丁。此前纯函数反例确实执行过，但不冒称新24条曾在旧版本跑红。
- 本次重新 query/context 仍显示 FTS 降级、context lower-bound；无可用 process。继续以完整当前函数、绑定 hash 的定向运行与只读 probe 补证，未新增或修改生产符号。

执行：前文六文件命令再加 `tests/rqa21-emphasis-regressions.test.js`。实际独立运行两次均 **193 tests / 193 pass / 0 fail / 0 skip，退出码0**；新24条均绿，原169条均绿。register-ts 同时输出一组外层0测试摘要，193是实际内层执行计数，不将两者重复计数。

执行时源码：

| 文件 | SHA256 |
| --- | --- |
| agent-source-citations.ts | `056bc174be6528300da6eff7fed231a17f01e5a7c26f5713a3a8c3b9ad1f6bf9` |
| agent-claim-source-check.ts | `de67c5c999ba44fe510b8bc4047b1ae8623f39d0ae6589bddcd695cac7885683` |
| agent-grounding-ledger.ts | `47cfa41709027adcf1652de22b145995e24ccdfda2312d397c4bafa3d24697f1` |

### 本轮补丁阅读与已关闭边界

完整阅读 `markdownCitationProse`：分隔符改为 decoration chunk；子节点先经过 code/link/HTML 过滤，再从投影中寻找纯 `_.-` bracket span 的字符偏移，仅在这些偏移保留 decoration。其余 em/strong 装饰丢弃。这恢复了原报告四个字段反例和两个未知引用反例，正例不再以空 fieldChecks 通过。

有界只读 probe 还确认：`[R_1][R_2]`、`[a_b][c_d]`、`[____][___]` 保持各自精确身份；夹在下划线之间的 Markdown code/link 产生空格，不拼出注册的纯标点 ID；强调包裹的可见 HTML span 中实际 citation 仍被读到。

HTML literal 的另一个现状：`**[__<code>x</code>__]**` 会投影成 `[____]`，不同于 Markdown code 的空格屏障。该现象涉及既有 `htmlCitationText` 空输出行为；本次没有证明它是新修补引入，不将其另列为本轮新P1，也不宣称所有 HTML crossing 均获得安全认证。

### 仍有 P1：注册的字母数字+下划线 ID 被改绑定为另一来源

位置：当前 `agent-source-citations.ts:81` 起的 identityOffsets 构造仅保护 `/\[[_.-]+\]/`，随后 decoration 过滤删除了合法 ID 中被 Markdown 识别为强调的下划线。`knownSourceIds` 尚未参与这一阶段，后面的 exact-ID 过滤无法恢复原始身份。

有限反例（不扩大到任意语义识别）：同时注册 `__R1__`（正文 `负责人：李明。`）与 `R1`（正文 `负责人：赵强。`）。

| 候选 | 前一修补版本 f241d44b | 当前 056bc174 |
| --- | --- | --- |
| `[__R1__] 负责人：赵强。` | ids=[__R1__]，unresolved，拒绝 | ids=[R1]，source_excerpt，sourceIds=[R1]，passed=true，gate.allowed=true |
| `[__R1__] 负责人：李明。` | source_excerpt，sourceIds=[__R1__]，通过 | unresolved，拒绝 |

前后归因同样使用**内存精确逆向还原**：将本次 decoration 改动还原后，整个 citations 文件 SHA 必须等于前一阶段记录的 `f241d44bd1d85be6bbf10a999545212f5a83a949af5c24f5f68192b490f137e1` 才加载；三个模块在隔离 vm 中实际调用。未改文件或生产模块缓存。前表结果已实际得到，不是仅根据正则推测。

当前可复算：

```powershell
@'
const { verifyClaims, applyOutputGate } = require('./src/lib/agent-grounding-ledger');
const { createProvidedMaterialsSnapshot } = require('./src/lib/provided-materials');
const providedMaterials = createProvidedMaterialsSnapshot({
  taskId: 'rqa21-identity-task', runId: 'rqa21-identity-run',
  materials: [
    { id: '__R1__', content: '负责人：李明。' },
    { id: 'R1', content: '负责人：赵强。' },
  ],
});
for (const text of ['[__R1__] 负责人：赵强。', '[__R1__] 负责人：李明。']) {
  const verification = verifyClaims({ text, providedMaterials });
  console.log(JSON.stringify({ text, passed: verification.passed,
    fields: verification.metadata.fieldChecks,
    gate: applyOutputGate({ text, verification, regenUsed: true }).allowed }));
}
'@ | node -r ./scripts/register-ts.js
```

需要明确处理“已注册的原样 ID”和“格式化 ID 内文”的优先级，不能将其静默映射到另一个已注册来源。建议对已注册原样身份优先或对冲突 fail closed，同时保住未知格式化引用的拒绝与 code/link 排除。不得仅补纯标点例外后宣称所有合法 ID 保真。

此项已立即通知主线。为遵守冻结要求，没有追改新24条或原37条；新增边界仅以只读 probe 和本附录留证。结论：原六反例已关闭，但在当前 hash 下仍不能宣称 RQA21 身份绑定全部安全。没有跑 fullcheck 或真实环境验收。

## 最终追加：注册原样 ID 修补与 P1 处置

2026-09-06，用户再次授权新增独立 `tests/rqa21-registered-emphasis-identity.test.js`；未修改前述24条、原37条或任何生产源码。

### 冻结与独立执行

- 新文件22条，SHA256：`6d8befc2a574812ba408e06eca5d766ae5effbb35fe3a1b0a649ac977a772501`。
- 24条文件仍为 `cfd69994bb833a08be4ce1bad2c1edd060b24110c3f6de7b3a3101417ae81e8c`；37条仍为 `86020442a8b28bba1d584b8109e616bfff8f9e73bf5d6f3caefeceeaf005a2c1`。
- 22条包括：单/双注册及 Set 的精确提取；未注册 decoration 的兼容控制；双注册下前置/后置引用的四种正确/错误支持；单注册时不虚构缺失可见ID；跨分句不借用；两个装饰未知引用；装饰字段名仍检查；来源与候选投影一致；注册 ID 位于 code/link 时仍排除。
- 新文件只调用已有公开接口，不依赖尚未存在的新选项来制造 TypeError 红测。断言验证具体字段、来源和 gate，不只是 passed。
- **首次执行已是 registry-aware 修补版本，没有新22条的历史红测结果**。前文纯函数前后对照仍是已实际取得的历史证据，与本次新测试执行记录分开。

独立命令：

```text
node -r ./scripts/register-ts.js --test --test-reporter=tap tests/rqa21-registered-emphasis-identity.test.js tests/rqa21-emphasis-regressions.test.js tests/rqa21-citation-placeholders.test.js tests/rqa18-citation-context-regressions.test.js tests/rqa18-claim-boundaries.test.js tests/rqa18-code-field-preservation.test.js tests/rqa18-html-local-scope.test.js tests/rqa18-source-citations-adversarial.test.js
```

实际 **215 tests / 215 pass / 0 fail / 0 skip / exit 0**，即22+24+37+132。未跑 fullcheck。

本次完整阅读与执行绑定：

| 文件 | SHA256 |
| --- | --- |
| src/lib/agent-source-citations.ts | `72f909d6d8e075bd8d43dfcb68fccbec98d2b5087e39723d785b6e1db8ff3879` |
| src/lib/agent-claim-source-check.ts | `b19b2f9da8bf6405fab8761e0ee1f3c47748763fd92676a5bfa1645f8fef9072` |
| src/lib/agent-grounding-ledger.ts（未变） | `47cfa41709027adcf1652de22b145995e24ccdfda2312d397c4bafa3d24697f1` |

### 代码依据与最终 P1 disposition

重新完整阅读 `markdownCitationProse`、`explicitSourceIds`、`labelledClaims`、`checkProvidedFieldClaims` 及相邻辅助函数。GitNexus context 仍是 lower-bound，无 process；源文件直接核对是本次判断依据，未将未知静态影响视为安全。主线报告四符号 impact/HIGH 已处理，本审查者未编辑这些符号。

1. `markdownCitationProse` 在处理子节点的 code/link/HTML 排除之后才构造 raw projection；只有纯标点 bracket 或 registry 中精确存在的合法原样 bracket 才保留内部 decoration。保护的是 bracket 内偏移，不是整句，因此 `**负责人**` 的外部装饰仍被剥离、字段仍被识别。
2. `explicitSourceIds` 将同一个 registry 传入该投影，之后继续用精确字符串提取与过滤；`__R1__` 不再先丢下划线后误认成 `R1`。注册原样 ID 的优先级只用于身份，不赋予字段支持。
3. `checkProvidedFieldClaims` 从 sources 统一生成 source ID 列表，同时传给候选 `labelledClaims`、所有来源 `labelledClaims` 及逐字段 `explicitSourceIds`。这关闭了“顶层引用正确、字段投影二次解析又错绑”的风险路径，而不是只修顶层报错。
4. 既有精确 label/value 匹配、allCitationsResolved、局部分句绑定、未知引用拒绝未被放宽；没有改执行证据、门禁状态或权限代码。

据代码路径与冻结反例共同验证：

- **原六反例 P1：关闭。** 四种无据装饰字段均进入 fieldChecks 并拒绝；两种装饰未知引用继续产生 missing ID 并拒绝。正确装饰字段实际得到 source_excerpt，不是空检查通过。
- **注册 `__R1__` → `R1` 借用 P1：关闭。** 双注册时李明只绑定 `__R1__`，赵强不能借用 `R1` 为该引用背书；前置、后置和跨分句均验证。单注册也不会错误变成 missing R1。来源侧与候选侧都使用一致 registry。

关闭结论限定上表 hash 和本轮明确契约，不将215绿描述为通用语义/事实认证、所有 Markdown 语法安全证明、真实模型验收或全仓check通过。前述 HTML literal 空拼接现状等未归因旧边界保留，不在本轮继续扩展。新22条及既有测试全部冻结，历史发现保留，本次最终无已复现且未关闭的本轮P1。
