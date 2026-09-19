# RQA18 packet/strict-parser 独立复审（2026-09-06）

结论：原冻结85项已全部转绿；仅追加10项后 **95/95通过、0失败/跳过，exit0**。保存的12份真实模型raw response，经最终helper离线重解析 **12接受、0拒绝、0结果变化**。这里的“接受”只指格式、绑定、覆盖及逐字anchor校验；不是21条声明全部正确、专家资格通过或产品授权。

本轮仅追加`tests/rqa18-review-packet.test.js`及本报告；未改helper、生产文件、原始证据或旧测试断言，未调用模型/API、访问QA/profile、运行全check。采用gitnexus-debugging导航；query报FTS降级，`hasDuplicateJsonKeys` context及测试文件impact未命中，风险UNKNOWN。fallback为完整读取当前helper与已有测试，不能把未知impact作安全证明。

## 代码与测试复核

- `scripts/qa-claim-review.js:13/19`：spread使稀疏空位进入校验，原2个创建红测关闭。
- `:72`附近的parse重建：验证packet顶层键/version，以host run/candidate/source/claim span重建canonical hash，并另核对claim id/text。原8个保留hash而篡改内容的反例均拒绝，包括替换来源再提交新“精确anchor”。
- `hasDuplicateJsonKeys`（`:45`）：先由JSON.parse判语法，再按对象层级收集解码键，原3个重复键红测关闭。新增Unicode转义重复键3项、唯一转义键/跨对象同名1项、字符串内伪JSON及转义1项、嵌套值重复键1项、标量version重复键1项，全部通过。
- 另新增同步伪造claimId与响应id、packet JSON roundtrip/键重排、Unicode候选UTF-16 span及NFC改变各1项，全部通过。原有覆盖缺失/重复/额外、supported无anchor、错误来源、严格类型/预算及输入输出隔离仍绿。
- 原85项全文前缀SHA256仍为`10aadecb689b105d87f44cb1cbdc8b5c02f0c91e37353ab02eaf851b82b4495e`；未把红测改成接受或skip。两次完整95项运行exit0，其中TAP汇总tests95/pass95/fail0/cancelled0/skipped0/todo0。

复跑：`node --test tests/rqa18-review-packet.test.js`。这些是本地研究原型测试，不含产品gate或模型调用。

## 冻结文件与版本（SHA256）

| 对象 | SHA256 |
| --- | --- |
| 原真实调用记录内helperHash（首次helper） | `6158f7fa8975edfe335e9ccdd891e68dcad9889fed8f1ed53ef6d5a7c2d06eff` |
| 本轮最终` scripts/qa-claim-review.js ` | `ffaf5fe852f2e19036448c1bdd583d8f390f9e3f0914bf397717279cd99f87a1` |
| 原始`rqa18-semantic-review-live-2026-09-06.json` | `f7b859d444acd80c824d9061d66ba0366c84a813d50127d2cff16a19b7c5a4f8` |
| 追加后的`tests/rqa18-review-packet.test.js` | `13bcbc1ffc1bbdb173978484c04375b665d8ee7b418e4d4731a79c62f99af336` |

真实记录标为completed/inputCount12，模型qwen3.8-flash，temperature0.2、outputTokens4096。这是历史调用元数据，**没有按最终helper重新请求模型**。旧helperHash字段及旧parsed字段保持原状。离线前后文件字节hash相等，解析前后内存输入JSON也相等。

## 离线重解析明细

每项直接使用`result.packet`和`result.response.snapshot.content`，不修JSON、不重写hash、不提取/补全决策。12/12重建packet深度相等；12/12与保存messages的user packet深度相等；12/12新parsed与旧parsed深度相等。每项finishReason=stop、toolCalls=0。

| id | runId | host claims | 严格解析 | 旧结果变化 |
| --- | --- | --- | --- | --- |
| SA-post-diagnostics | rqa18-shadow-1 | 2 | 接受 | 无 |
| SA-initial | rqa18-shadow-0 | 2 | 接受 | 无 |
| SR01 | rqa18-shadow-SR01 | 1 | 接受 | 无 |
| SR02 | rqa18-shadow-SR02 | 1 | 接受 | 无 |
| SR04 | rqa18-shadow-SR04 | 2 | 接受 | 无 |
| SR03 | rqa18-shadow-SR03 | 3 | 接受 | 无 |
| SR05 | rqa18-shadow-SR05 | 1 | 接受 | 无 |
| SR06 | rqa18-shadow-SR06 | 2 | 接受 | 无 |
| SR08 | rqa18-shadow-SR08 | 2 | 接受 | 无 |
| SR09 | rqa18-shadow-SR09 | 1 | 接受 | 无 |
| SR07 | rqa18-shadow-SR07 | 3 | 接受 | 无 |
| SR10 | rqa18-shadow-SR10 | 1 | 接受 | 无 |

共**21 decisions/21 host claims、31 anchors**；kind为derived_analysis15、reported_fact6；assessment为supported11、unsupported9、uncertain1；supported缺anchor为0。这些是模型返回分布，不是正确率。

逐项精确绑定如下，raw hash按UTF-8原始response字符串计算，不含额外换行：

| id | packetHash | raw response SHA256 |
| --- | --- | --- |
| SA-post-diagnostics | `880b6555f7b5642a966e0da950630988e20280e8c8117738e3aee3d69156019e` | `1b8313dd0b8e104aa7dbf112b5d235518e6b834101fe19e481be44dc3301a739` |
| SA-initial | `f045da407a020b33c862216b866d8cbb4a071219dcfdba28f8aa832983f16e65` | `d68208b5e72d6f91aae68b8ae35038fbcac7c4b1c5247a788b3b6d0e325ae75c` |
| SR01 | `cb5e2385bb0dfd94b8c10dc8a6d9a2c490fe2bb62faaa7881d312b800b072860` | `fdd0cb38a88bf563085f5475080d89d59d67f1507abffc1cd171143c20fdb64f` |
| SR02 | `46e19524209306d4d0f9053073b08ed21b53810abb4aac51f38f39c53b4130fe` | `03c0e97046fbeb339d4aec9f4ce5b89212f29439c7670930f0bbaf7adc6cdf06` |
| SR04 | `db7671af0211f34369dfbbc93ea2708e00c48676a88a60a21907fce3f88f2975` | `b3af81b640871da44a7bab3794dc315c127241ed11fc58649132674f52bff6d5` |
| SR03 | `d06e1528978a8899717c3f7a67316efc9be0cf8c1ce5c0159bf308e4f986f206` | `ccbcfb787e6b69c063abddb6351d6f6b8b23e30e93ea7c6aafeee4532e90d9f3` |
| SR05 | `44cf6e682352a91d0a99e01984588c4a6cd1810aae7ddd50421174eecbabbf0c` | `61303ad6304b2630c34b74d57d0172983f98442b7db819da6859cd22d0578594` |
| SR06 | `c283ec88f0e4f0a3d026acfde8c299dd7cd9c5007fb2e8a873bf8ff1ddab96ef` | `1b0eadd2f2827d48a432420b19ca246809d276dc41e42dbbef346eb5c24be009` |
| SR08 | `6169a346242297fd20abac2f22a05baf1c235fd4bf7955809cfd65ba359dbace` | `fcd143e988bdd4223a449078b74c0ee67221b9039f7824d89390fea900f3f82c` |
| SR09 | `fb53cd41b3d8e090ac767bea6fe974e4bb0539ff48cd503d3087b92265efa5cc` | `bb003a3e4997605eb2ce7df0e00c5acf14b59b3692a23d68cef49b2fbbb11b23` |
| SR07 | `dae56395852736647d582f34a009b5bfd04d8ffd1e0577f445fafabb5169b980` | `3ed080b16ebea9480f7a151d0ce8f07df51fb6ea83d79e2d6580ca41dc85a70f` |
| SR10 | `ae728234dfab8b49c42353614b95c4c863f79830506c8059b58a9ae69e525530` | `30fbcec15f517a79ace5cebff4c625eab11e483383b1fe49b1138f0e5a9cb76b` |

## 剩余边界，不扩大为产品结论

1. canonical hash确认内容一致，不是签名或可信来源证明。仍要求host持有原始packet/run绑定；不应从模型取回一个自洽但全新的packet再当原任务审查依据。本轮不引入认证/授权功能。
2. 覆盖仅针对host选定的21个span，不保证完整candidate的所有重要声明被挑出。SA两份长答复各仅2个claim，不能把这2项分类/支持判断升级为全文专业验收。
3. 精确anchor可用于反驳，也可能与结论无关；supported有anchor仍不等于语义成立。原测试专门保留“与批准声明相反的精确来源仍能结构解析”的正例，不把语义模型职责偷偷放入parser。
4. 原始SR07-C3模型reason明确指出t=10等待8秒是反例，并说全称判断错误，却填`assessment=uncertain`。这是可见的标签/理由不一致，严格parser不会也不应凭关键词纠正它；不能宣称21/21语义正确。
5. 返回reason也需复核，不是证据本身。SA-post-diagnostics-C2理由借排空80分钟论证SLA缺口，不单独验证候选关于特定事件80分钟等待的说法；选定宽泛SLA结论被supported不代表候选其他数值被审过。SR09把缺失R9整体判unsupported，但理由承认R1算术7×4=28正确，也说明“来源完整性”和“推导数值正确”不能混成一个成功率。

## 可执行离线复算脚本

仓库根PowerShell运行以下命令，只读已保存证据及研究helper；不导入产品、不写文件、不请求模型。输出各packet/raw/candidate/source hash及结构统计，便于对报告逐项核验。

```powershell
@'
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createClaimReviewPacket, parseClaimReview } = require('./scripts/qa-claim-review');
const path = 'openspec/changes/production-qualify-all-experts/evidence/rqa18-semantic-review-live-2026-09-06.json';
const bytes = fs.readFileSync(path), live = JSON.parse(bytes);
const original = JSON.stringify(live);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const counts = { responses: 0, accepted: 0, rejected: 0, changed: 0,
  claims: 0, anchors: 0, kinds: {}, assessments: {}, supportedWithoutAnchor: 0 };
const rows = live.results.map(row => {
  const raw = row.response.snapshot.content;
  assert.deepEqual(createClaimReviewPacket(row.packet).packet, row.packet);
  assert.deepEqual(JSON.parse(row.messages.find(m => m.role === 'user').content), row.packet);
  const parsed = parseClaimReview(row.packet, raw);
  counts.responses++;
  counts[parsed ? 'accepted' : 'rejected']++;
  if (JSON.stringify(parsed) !== JSON.stringify(row.parsed)) counts.changed++;
  for (const d of parsed?.decisions || []) {
    counts.claims++; counts.anchors += d.anchors.length;
    counts.kinds[d.kind] = (counts.kinds[d.kind] || 0) + 1;
    counts.assessments[d.assessment] = (counts.assessments[d.assessment] || 0) + 1;
    if (d.assessment === 'supported' && !d.anchors.length) counts.supportedWithoutAnchor++;
  }
  return { id: row.id, runId: row.packet.runId, packetHash: row.packet.packetHash,
    rawSha256: sha(raw), candidateSha256: sha(row.packet.candidate),
    sourceHashes: row.packet.sources.map(s => ({ id: s.id, sha256: sha(s.text) })),
    accepted: !!parsed, sameAsSaved: JSON.stringify(parsed) === JSON.stringify(row.parsed) };
});
assert.equal(JSON.stringify(live), original);
assert.deepEqual(fs.readFileSync(path), bytes);
console.log(JSON.stringify({ recordedHelperHash: live.helperHash,
  strictHelperHash: sha(fs.readFileSync('scripts/qa-claim-review.js')),
  evidenceHash: sha(bytes), counts, rows }, null, 2));
'@ | node
```
