# RQA12 第一层：provided-materials 确定性数据流交接

日期：2026-09-06。状态：实现完成，定向45/45通过；不代表 claim 语义 gate 或真实专业验收完成。

## 可集成 API

模块：src/lib/provided-materials.ts，CommonJS，局部 JSDoc 类型；现有 IPC payload 是 Record<string, unknown>，本轮未改共享类型文件。

```js
createProvidedMaterialsSnapshot({ taskId, runId, materials })
validateProvidedMaterials(snapshot, { taskId, runId })
providedMaterialsFromInput(input, runId)
```

- create 只接受调用者传入的当前 task.brief.materials；正式执行入口已在本次 runId 确定后调用。
- validate：null/undefined 返回 null；合法返回规范化且逐层冻结的新快照；非法抛错，code=provided_materials_invalid，错误正文不包含材料内容。
- FromInput：取 taskRef.id 或 workbenchTaskId（不用 Skill taskId），两者同时出现必须一致；payload.runId 与宿主 runId 也必须一致。
- 主线 GROUND 应校验 ctxBundle.providedMaterials，并使用返回值；taskId/runId 必须取实际运行身份，不能从 snapshot 自身取值来“验证”自己。

```ts
{
  version: 1,
  kind: 'provided_materials',
  taskId, runId, snapshotHash,
  items: [{
    id, title, text, contentHash,
    origin: 'user_material',
    completeness: 'unknown'
  }]
}
```

contentHash 为正文 UTF-8 SHA256；snapshotHash 为规范化 version/kind/taskId/runId/items 按固定属性顺序 JSON.stringify 后 SHA256。与调用绑定有关的 task/run、条目次序、id/title/text 等均被覆盖。hash 不构成签名、授权、来源真实性或事实正确性证明；客户端可计算 hash，因此绝不能据此把 user_material 升为工具/权威来源。

## 本轮具体修改

| 文件/既有符号 | 本轮增量 | 影响/风险 |
|---|---|---|
| src/lib/provided-materials.ts（新） | 快照创建、验证、身份绑定，全文hash、冻结及预算 | 无 I/O；显式拒绝非法输入，不裁剪后继续 |
| src/lib/expert-task-runtime.ts / execute | :520创建当前材料快照，:562随generate payload传递 | 覆盖正式执行、修改、重试、恢复；不取SOP/history/旧artifact |
| src/lib/agent-generate-prepare.ts / prepareAgentGenerate | :115在配置读取前验证，:819返回providedMaterials | 非法快照尽早失败；缺省快照保持兼容 |
| src/lib/agent-generate-execute.ts / executeAgentGenerate | :84放入ctxBundle，并带实际task身份；:178向Executor覆盖传入已验证prepared值 | 不让原始payload覆盖准备阶段已验证的快照 |
| src/lib/agent-run-kernel-adapter.ts / buildProductionRunPorts | :61校验并固定本ports快照；:209构建context时再次绑定实际input | 防止ports被跨task/run复用；老调用无快照返回null |
| tests/rqa12-provided-materials-dataflow.test.js（新） | 8项独立数据流/边界测试 | 隔离临时store与内存session；不依赖QA路径 |

本轮未修改 grounding-ledger、phases-ground-persist、catalog、现有语义红测或冻结QA结果。现有文件已有其他Agent修改；git相对HEAD的整文件diff/numstat不是本轮增量。

## 来源和预算边界

- 仅非图片、非空白的 material.content 进入条目。只有标题/链接的材料不变成正文；不打开URL/文件，不取图片说明或dataURL作为文字证据。
- 正文不trim、不截断；主字段与hash都保留原字符串，前后空白也保留。
- 创建器忽略材料自报source/status/provenance/completeness，固定user_material/unknown；validator拒绝其他origin或complete等未获证明的完整性值。
- 不写ToolLedger/EvidenceLedger，不产生执行成功回执，也不把快照放进历史消息或系统指令。
- 限制最多32项输入材料、所纳入文字合计1MiB UTF-8，超过显式错误；每条id/title有长度界限，重复id显式错误。这是资源准入上限，不替代模型上下文预算。
- 当前任务存储层已有32项/每项8000字符的历史裁剪，本模块无法恢复丢失内容。完整性全部unknown，不因短文本或收到的JSON完整就宣称原材料完整；本轮不改入库规则。
- retry新run重新产生绑定快照；相同正文hash可相同，但snapshotHash随runId变化。历史artifact仍可存在于模型修改上下文，但不纳入provided-material证据。

## GitNexus impact 与手查

改动前逐一查询 execute（限定expert-task-runtime.ts）、prepareAgentGenerate、executeAgentGenerate、buildProductionRunPorts 的 upstream impact。

四项均返回 UNKNOWN、epistemic=lower-bound、direct=0、processes=0，提示调用关系未解析、scope-extraction-unverified；已在改动前告知主线，不解释为低风险或无人调用。

手查的直接边界：

- execute：create/start、修改、retry、queued恢复等本runtime入口都会调用。
- prepareAgentGenerate：executeAgentGenerate调用。
- executeAgentGenerate：runAgentGenerate共用非UI入口调用，包含IPC和专家任务。
- buildProductionRunPorts：executeAgentGenerate、agent-generate-child-ports、main/agent-runtime使用；未传新字段的旧调用仍合法。

没有修改已有函数签名或工具/完成契约；新增模块没有已有索引符号可供影响证明。

收尾执行 detect_changes(scope=unstaged)：整个共享工作树305个已改文件、566个changed symbols、160 affected、整体CRITICAL。已向主线报告，不能把这个全树结果归因于本轮，也不能用它证明仅预期符号发生变化；本报告以上列举实际apply_patch触及范围并附hash。未commit、未重建索引或覆盖其他Agent修改。

## 红绿证据与定向测试

先加入两个使用既有runtime/adapter的测试，未依赖尚未存在的新模块来制造失败：

- expert payload缺providedMaterials → ERR_ASSERTION；
- production context缺providedMaterials → ERR_ASSERTION。

初始2 tests / 0 pass / 2 fail，exit1。实现后这两项转绿，再补6项边界测试：

1. 真实expert execute只取当前brief文本，排除SOP/system/历史/旧artifact、图片与仅链接材料；
2. 真实production context保留绑定快照，执行台账仍为空；
3. 超过14000字符的正文逐字节保留、深冻结、新run重新绑定；
4. 身份错配、正文/title/hash篡改、重复id和自报complete等明确拒绝，错误不回显私密正文；
5. 33项、UTF-8多字节超额、合计超额拒绝，恰1MiB正文完整通过；
6. 缺省快照兼容，跨task/run复用ports拒绝；
7. 真实prepare对错run快照在任何settings读取前拒绝；
8. 实际execute投影→真实kernel adapter/context→真实AgentRunExecutor链路传递规范化快照，原始payload不覆盖prepared结果。

最后运行：

```powershell
node -r ./scripts/register-ts.js --test tests/rqa12-provided-materials-dataflow.test.js tests/expert-task-runtime.test.js tests/agent-generate-execute.test.js tests/agent-generate-free-idents.test.js tests/ai-generate-ipc.test.js
```

结果：exit0，45 tests / 45 pass / 0 fail / 0 skip（新文件8项，既有相邻37项）。包括真实executor缺资源/审批投影、专家修改/恢复/queued/retry等。

测试真实性边界：外部模型完成是内存替身，未调用真实API；execute集成用替身隔离prepare的外部上下文发现和工具投影，消费其约定输出，未宣称完整真实prepare成功路径已被端到端执行。真实prepare的非法快照入口执行过。所有被测快照创建/校验、expert runtime、production adapter及最后Executor都使用实际实现。中间集成fixture曾缺少API配置，补齐fixture后通过，未通过放宽生产校验解决。

没有跑fullcheck、renderer或实际Electron；主线负责GROUND、声明有限范围校验及最终全量/真实验收。

## 覆盖 hash（SHA256）

| 文件 | SHA256 |
|---|---|
| src/lib/provided-materials.ts | a7c9842b41387a3e47eb2e2da5f4af46806a73cdb62246ea96328ddc006c14f7 |
| src/lib/expert-task-runtime.ts | 48bf68be9ea5d6641cf3c7e476b5cecc3903fe3eae5e097c49c5bd5807bfb05e |
| src/lib/agent-generate-prepare.ts | 4f28b4ad9717c836b60539d742db90de3ed03160ab37000bcdf38dcb0dbd54f6 |
| src/lib/agent-generate-execute.ts | ef1a2f021fc5d395518f0a273a721acb76f934edff14e9600b34dc18590d0dde |
| src/lib/agent-run-kernel-adapter.ts | bcfa56eeabbae0a2b4bf8da815503f1c2646e804ae0011d788d16ba247b2b50d |
| tests/rqa12-provided-materials-dataflow.test.js | f3fa5492472704811e1aa13a5c1676daa9c0d291af309a4d25210d1b293c9c48 |
