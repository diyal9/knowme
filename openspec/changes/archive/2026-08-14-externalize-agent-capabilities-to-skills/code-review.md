# Code Review: externalize-agent-capabilities-to-skills

- **Reviewer**：独立代码审查
- **日期**：2026-08-06
- **范围**：仅审查本 change 指定的 Skill/Task/Pack runtime、Main/Preload/Renderer 接线、8 个办公 Skill、game-studio Pack/scenes、对应 tests 与 OpenSpec
- **方法**：源码走读、隔离临时目录负例复现、定向测试、全量测试、lint、OpenSpec strict validate

## 最终复审结论（2026-08-06）

**PASS** — B1–B8 的原始负例均已独立复现确认关闭，未发现新的 BLOCKING。代码审查通过，可进入制作人复验/QA。

- B7：动态执行与缺素材恢复均传递 `taskId`；Main 从可信 task catalog 重新解析并校验 Skill 归属；runtime 仅合并当前 task 的 sidecar tools。
- B8：Pack scene 映射完成后会追加未被 scene 表示的 Pack-owned general empty task；`todayPriority` 已作为第 5 张 general 卡呈现。

原 A1–A3 与新增 A4 仍为非阻塞建议项，不影响本次通过结论。

## 初审结论（历史）

**BLOCKED** — 发现 6 项可复现 BLOCKING。当前不能进入门禁，也不能按现有 `acceptance.md` / `evidence/test-report.md` 的“无 BLOCKING”结论归档。

现有自动化全部通过，但未覆盖下列 Pack ID 路径穿越、复制失败事务残留、bundled 依赖绕过、sidecar requiredTools 未进入运行时门禁、跨来源 task 去重错误，以及 Pack-owned 写作任务退回 legacy 的路径。

## BLOCKING

### B1：Renderer 可通过未校验 Pack ID 删除 userData 下任意相对目录

- **位置**：
  - `src/main.js:2736-2761`
  - `src/lib/capability-pack-runtime.js:650-657`
  - `src/lib/capability-pack-store.js:96-105`
- **原因**：Preload 暴露的 `capability-pack-uninstall` IPC 接受任意 `packId`；主进程和 runtime 均未用 `PACK_ID_RE` 校验。`uninstallPack()` 直接把该值传给 `installedDir()`，随后对解析后的目录执行递归删除。
- **隔离复现**：
  1. 在临时 `userData` 下创建 `victim/keep.txt`。
  2. `createCapabilityPackRuntime({ userData }).uninstallPack('../../victim')`。
  3. 返回 `{"ok":true,"packId":"../../victim"}`，且 `victimExists:false`。
- **影响**：Renderer/XSS/DevTools 可越过 `capability-packs/installed` 边界删除用户数据；这也是 Pack 生命周期入口的直接破坏性路径。
- **判定**：安全 BLOCKING。

### B2：Pack 复制失败被忽略，空/残缺目录仍被登记为 enabled

- **位置**：`src/lib/capability-pack-runtime.js:660-696`
- **原因**：`copyDirectorySafe(srcDir, dest)` 的返回值未检查；即使复制因符号链接或其他错误失败，代码仍写入 enabled store 并返回成功。复制函数还会先删除同 ID 的旧目录，因此更新失败会丢失原版本。
- **隔离复现**：
  1. 创建合法 legacy Pack 源目录，并加入指向外部文件的符号链接。
  2. 调用 `installFromDirectory(src)`。
  3. `copyDirectorySafe` 拒绝链接后，实际结果仍为 `{"ok":true,"packId":"tx-pack"}`。
  4. Store 条目为 `status:"enabled"`，但安装目录为空，hash 为 `e3b0c44298fc1c14`。
- **违反规格**：`specs/capability-pack/spec.md` 的 “Pack and bundled Skill lifecycle is transactional”。
- **判定**：生命周期/事务 BLOCKING。

### B3：bundled Pack 可绕过原子依赖检查

- **位置**：
  - `src/lib/capability-pack-runtime.js:562-600`
  - `src/main.js:114-124`
- **原因**：
  - 生产接线没有提供 `getAvailableCapabilityManifests`，fallback 只检查 `manifest.dependencies`，忽略 `expert`、`skills`、`connectors` 适配出的统一依赖。
  - 即使统一依赖检查返回失败，`installPack()` 对 `source === 'bundled'` 明确忽略失败。
- **隔离复现**：以 `getAvailableCapabilityManifests: () => []` 创建 runtime，再执行 `installPack('game-studio', 'bundled')`；在 expert/connector 均不可用时仍返回 `ok:true`。
- **影响**：Pack 可在缺少必需 expert/connector/tool 能力时被标记 enabled，不符合 proposal 的原子依赖验收标准。
- **判定**：依赖安全 BLOCKING。

### B4：sidecar 的 requiredTools 只影响 DTO，不进入实际 Registry/grounding 门禁

- **位置**：
  - `src/lib/skill-task-ui.js:247-255`
  - `src/lib/skill-runtime.js:610-631,827-872`
  - `src/workspace-agent.js:4069-4079`
  - `src/main.js:4100-4115`
- **原因**：Renderer 的 `canActivateDynamicTask()` 只检查“有 requiredTools 时是否存在 skillId”，没有检查工具是否可用。主进程运行时 grounding contract 又只从 `SKILL.md` frontmatter 读取，不消费 task sidecar 的 `requiredTools`。
- **隔离复现**：
  1. 临时 Skill 的 sidecar task 声明 `requiredTools:["feishu.related_chats"]`。
  2. 同一 Skill 的 `SKILL.md` 不声明 grounding requiredTools。
  3. `listSkillTasks()` DTO 正常包含 requiredTools；`canActivateDynamicTask(task) === true`。
  4. `loadSkillGroundingContract()` 返回 `requiredTools:[]`。
- **影响**：声明缺失/禁用工具的动态 task 仍可进入模型执行，无法保证“缺工具必须阻断并点名”。
- **违反规格**：
  - `specs/agent-skills-runtime/spec.md` “Skill requests unavailable tool”
  - `specs/capability-manifest/spec.md` “resolved against the enabled host Registry at activation time”
- **判定**：宿主安全边界 BLOCKING。

### B5：跨来源重复 task ID 的优先级实现会保留两条记录且无告警

- **位置**：`src/lib/skill-runtime.js:827-872`
- **原因**：当低优先级来源先被遍历、高优先级来源后到达时，代码更新 `seenTaskIds`，但没有从 `tasks` 删除旧 DTO，随后又 push 新 DTO。records 按 skill ID 排序而非 source rank，因此该顺序可稳定出现。
- **隔离复现**：
  - Pack Skill `a-pack` 和 managed Skill `z-managed` 均声明 `sharedTask`。
  - 返回 tasks 同时包含 `{title:"Pack",source:"pack"}` 与 `{title:"Managed",source:"standard"}`。
  - `issues` 为空。
- **影响**：IPC 返回重复 identity，Renderer `Map` 的最终胜者依赖顺序，属于静默覆盖；与确定性来源优先级及重复 ID 诊断要求冲突。
- **判定**：来源优先级/身份一致性 BLOCKING。

### B6：Pack-owned 的 4 个写作动态任务在空状态被主动过滤，实际仍走 legacy

- **位置**：
  - `src/lib/skill-task-ui.js:45-79`
  - `src/workspace-agent.js:2581-2589`
  - `src/packs/game-studio/pack.json:13-20`
  - `src/packs/game-studio/scenes.json`
- **原因**：`resolveEmptyStateCards()` 对动态任务执行 `.filter(task => !task.ownerPackId)`。4 个写作 Skill 由 game-studio Pack 提供，但 `scenes.json` 没有对应写作场景，因此它们既不会进入普通动态空状态，也不会通过 Pack scene 渲染。
- **隔离复现**：向 `resolveEmptyStateCards('writing', ...)` 传入 `ownerPackId:'game-studio'` 的 `writingOfficeDoc` 动态 task，结果为 legacy 标题且 `dynamic:false`。
- **影响**：修改写作 Skill sidecar 的 title/prompt 不会更新 writing 空状态；空状态与 quick-menu 不再是同一 task identity/preflight 路径。
- **违反规格**：
  - `specs/agent-chat-ux/spec.md` 的双 surface 同 identity
  - `specs/office-assistant/spec.md` 的 writing mode 与 Skill 内容可更新要求
- **判定**：核心迁移验收 BLOCKING。

## ADVISORY

### A1：Main 接受 Renderer 任意 skillRefs，未绑定到已下发 task identity

- **位置**：`src/main.js:3827-3898`、`src/workspace-agent.js:4540-4563`
- **说明**：`ai-generate` 直接接收 Renderer 的 `skillRefs`，仅做 slash 规范化；普通 Session 无 expert bindings 时可请求任意 enabled Skill。
- **风险**：当前 slash 手动激活语义使其不一定构成权限提升，但 task 点击路径无法证明 ref 确实来自当前 task catalog。建议主进程限制数量/格式，并在 task 激活场景按 taskId/revision 重新解析 Skill ref。

### A2：Manifest 仍保留未知 metadata/permissions，Hub 投影未做敏感值 allowlist

- **位置**：
  - `src/lib/capability-manifest-v2.js:160-191`
  - `src/lib/capability-hub-service.js:81-123,139-171`
- **说明**：`metadata`、`metadata.knowme` 与 `permissions` 先被通用深拷贝；除 experience 内部外，未知字段不会被删除。Hub 又把 permissions/provenance 投影给 Renderer。
- **风险**：当前 8 个内置 sidecar 未携带 secret，`skill-task-list` DTO 也未发现 path/body/script 泄漏；但第三方 sidecar 若错误写入 token、绝对路径或任意权限值，Capability Hub 仍可能收到。建议为 Renderer 建独立 display-safe allowlist。

### A3：Cursor/Claude Code 兼容只验证了 KnowMe 自有解析器

- **位置**：`tests/skill-runtime*.test.js`、`tests/office-catalog-skills.test.js`
- **说明**：现有测试确认 8 个 `SKILL.md` 可被 `parseSkillFrontmatter()` 解析，但没有调用 Cursor/Claude Code 的真实校验器。新增 Skill frontmatter 还包含 `slash`、`version`、`requiredTools` 等宿主字段。
- **建议**：增加外部格式 fixture/validator，至少覆盖 Claude Code 标准字段、Cursor 仅 `SKILL.md` 包、`references/assets/scripts` 目录，以及未知 frontmatter 字段的真实兼容行为。

### A4：开发自测摘要的计数仍是修复前数据

- **位置**：`evidence/dev-self-test.md:6-7`
- **说明**：文件仍记录定向 53/53、全量 1176/1176；本次独立执行的当前结果是定向 57/57、全量 1178/1178。
- **建议**：进入正式 gate 前同步证据摘要，避免测试报告与实际 suite 数量不一致。

## 通过项

- 8 个办公 Skill 的 `SKILL.md` 与 sidecar 均能被当前 KnowMe runtime 解析，内置飞书 Skill 的 frontmatter/sidecar requiredTools 一致。
- 无 sidecar 的标准 Skill 不会因缺少 KnowMe experience 扩展失效。
- experience validator 对 task ID、mode/surface/icon/group、模板标量、URL/脚本表达式、approval bypass/secret key 做了有界校验。
- `skill-task-list` 的正常动态/legacy DTO 未发现绝对路径、Skill body 或 script 字段泄漏。
- imported Pack 的声明式 `catalogRoot` 越界负例可被拒绝；安全复制会拒绝符号链接（但调用方未处理失败，见 B2）。
- Pack disable 后 Pack scenes 与 Skill sources 会从后续 discovery 消失。
- 显式 Skill L1 可独立于用户可见 prompt 注入，用户气泡无需显示 `/skill-id`。
- `KNOWME_TEST_USER_DATA_DIR` 仅在 `KNOWME_TEST_SEAM === '1'` 时生效；未发现 Renderer payload 可开启该 seam。
- bounded 日期增强不执行 `${...}`、`{{...}}`、`eval` 或任意 URL 表达式。

## 独立检查结果

- Preflight：PASS，`needs_fix=false`
- 定向测试：PASS，79/79
- 全量 `npm test`：PASS，1170/1170
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- `npx openspec validate externalize-agent-capabilities-to-skills --strict`：PASS
- 额外隔离负例：上述 B1–B6 均已复现；临时目录已清理，未修改产品代码

## 独立复审（2026-08-06）

### 原 B1–B6 复审结果

| 编号 | 复审结论 | 独立验证 |
|---|---|---|
| B1 | **CLOSED** | `uninstallPack('../../victim')` 返回 `invalid_pack_id`；临时 `victim/keep` 保留。runtime、store 的 ID 校验和安装根路径 guard 均存在。 |
| B2 | **CLOSED** | 先安装旧版，再以符号链接源更新；返回 `pack_copy_failed`，旧 `pack.json` 与 enabled store 状态保留。staging 复制成功后才交换，交换/登记失败会尝试恢复 backup 与旧 entry。 |
| B3 | **CLOSED** | `getAvailableCapabilityManifests: () => []` 下安装 bundled `game-studio` 返回 `dependency_conflict`；生产接线从 capability catalog 提供 manifests，Pack-owned Skill manifests 作为 additional available 参与同一次检查。 |
| B4 | **CLOSED** | 仅在 sidecar task 声明 `feishu.related_chats` 时，`loadSkillGroundingContract()` 已返回该工具；`src/main.js:4311-4315` 在模型生成前按实际 `toolSurface.isAllowedTool()` 点名阻断不可用工具。 |
| B5 | **CLOSED** | Pack/standard 同名 task 仅返回一条 standard DTO，并稳定产生 `duplicate_task_id`；返回数组来自 winner `Map`。 |
| B6 | **CLOSED** | Pack-owned `writingOfficeDoc` 在 writing 空状态覆盖 legacy，返回 `dynamic:true`；真实 UI smoke 也已覆盖四张 writing 卡片。 |

### 新增 BLOCKING

#### B7：多 task Skill 的 requiredTools 被错误合并为 Skill 级并误阻断

- **位置**：
  - `src/lib/skill-runtime.js:628-636`
  - `src/workspace-agent.js:4071-4081`
  - `src/main.js:4311-4315`
- **原因**：
  - `loadSkillGroundingContract()` 对 `experience.tasks` 使用 `flatMap`，把同一 Skill 所有 task 的 `requiredTools` 合并到一个 Skill grounding contract。
  - Renderer 激活动态 task 时只把 `skillId` 放入 `skillRefs`，没有把可信 `taskId` 交给主进程重新解析。因此主进程不知道本轮激活的是哪个 task，只能对合并后的全集做 tool-surface 检查。
- **隔离复现**：
  1. 创建一个合法 Skill，包含 `taskA(requiredTools:["alpha.read"])` 与 `taskB(requiredTools:["beta.read"])`。
  2. `listSkillTasks()` 中 `taskA.requiredTools` 正确仅为 `["alpha.read"]`。
  3. `loadSkillGroundingContract("multi-task").contract.requiredTools` 却为 `["alpha.read","beta.read"]`。
  4. 激活 `taskA` 时，只要 `beta.read` 未投影，`src/main.js:4311-4315` 也会返回“所需工具不可用”，尽管 `taskA` 从未声明该工具。
- **影响**：任何含多个异构 task 的有效 Skill 都可能因其它 task 的无关依赖无法运行；task 声明不能独立控制 required tools，也无法通过更新 sidecar 修正业务行为。
- **违反规格**：
  - `specs/agent-skills-runtime/spec.md` “Each valid declaration ... required tools”
  - “WHEN a task declares a required tool ... THEN activation is blocked”要求按当前 task 而不是整个 Skill 判定
- **判定**：核心 task 激活契约 BLOCKING。

#### B8：todayPriority 声明 empty surface，但 general Pack 分组使其不可见

- **位置**：
  - `src/catalog/skills/feishu-today-priority/capability.manifest.json:12-26`
  - `src/lib/skill-task-ui.js:45-50`
  - `src/workspace-agent.js:2617-2620`
  - `src/packs/game-studio/scenes.json:2-50`
  - `evidence/skill-driven-electron-smoke.js:130-139`
- **原因**：
  - `todayPriority` 明确声明 `modes:["general"]`、`surfaces:["empty","quick-menu"]`，且由 `game-studio` Pack owning。
  - `resolveEmptyStateCards()` 在 general 模式过滤所有 Pack-owned task；`renderEmptyState()` 只要存在 Pack HTML 就整页提前返回。
  - Pack 分组只从 `scenes.json` 的四个可见 scene 渲染；其中没有 today-priority scene，所以该 task 没有任何 general 空状态落点。
- **隔离复现**：
  1. 启用 `game-studio` 后，task catalog 中 `todayPriority.surfaces` 包含 `empty`。
  2. 对真实 `listEmptyStateGroups()` 执行 `resolvePackEmptyCards()`，得到 `docKbSuggest`、`meetingSummary`、`relatedChats`、`workflow-intake`。
  3. 结果不含 `todayPriority`；而 Workspace 在存在该 Pack 分组时不会继续渲染普通 general cards。
- **现有 smoke 缺口**：`general-empty-cards-visible` 只断言三张指定卡、`需求梳理` 和总数 4，未断言 `todayPriority`；因此 Electron 15/15 不能证明声明的全部 empty surfaces 已呈现。
- **影响**：内置办公 Skill 已出现声明与 UI 不一致；更新其 title/prompt 也不会影响 general 空状态。任意没有对应 legacy scene 的 Pack-owned general task 都会被同样静默隐藏。
- **违反规格**：`specs/agent-chat-ux/spec.md` 要求声明当前 mode 的 empty + quick-menu task 以同一 identity 出现在两个 surface。
- **判定**：现有内置任务与核心动态 surface 迁移 BLOCKING。

### 复审检查结果

- 原 B1–B6 隔离负例：6/6 已关闭
- 新增隔离负例：B7、B8 均稳定复现；临时目录已清理
- 定向回归：PASS，99/99
- 全量 `npm test`：PASS，1176/1176
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- `npx openspec validate externalize-agent-capabilities-to-skills --strict`：PASS
- Electron 证据：已复核现有 15/15 报告与脚本；writing B6 覆盖有效，但 general 断言没有覆盖 B8

## 第二次独立复审（2026-08-06）

### B1–B6 回归确认

| 编号 | 最终结论 | 独立复现结果 |
|---|---|---|
| B1 | **CLOSED** | traversal ID 继续返回 `invalid_pack_id`，临时 victim 文件保留。 |
| B2 | **CLOSED** | 符号链接复制继续返回 `pack_copy_failed`，已安装旧版内容保留。 |
| B3 | **CLOSED** | 空 capability availability 下 bundled Pack 继续返回 `dependency_conflict`。 |
| B4 | **CLOSED** | 单 task sidecar 工具仍进入 task-scoped grounding contract。 |
| B5 | **CLOSED** | 跨来源重复 task 仍只保留 standard winner，并报告 `duplicate_task_id`。 |
| B6 | **CLOSED** | Pack-owned writing task 仍覆盖 legacy，返回 `dynamic:true`。 |

### B7 最终复审：CLOSED

- **实现核对**：
  - `src/workspace-agent.js:4071-4081` 动态 task 执行把 `task.id` 独立传给 `runAI()`。
  - `src/workspace-agent.js:4052-4062,4323-4334,4558-4568` 缺素材暂存与恢复路径保留同一 `taskId`，不会恢复成无 task identity 的 Skill 调用。
  - `src/main.js:3906-3914` 使用 Main 侧 `listSkillTasks()` 重查 task，并要求可信 `task.skillId` 存在于本轮 `skillRefs`；伪造、过期或不匹配 identity 会在 context assembly 前阻断。
  - `src/lib/capability-hub-service.js:769-779` 与 `src/lib/agent-context-assembly.js:127-141` 把 task identity 传入 Skill grounding 加载。
  - `src/lib/skill-runtime.js:628-639` 只合并与 `options.taskId` 精确匹配的 experience task tools；无 taskId 的手动 Skill 调用不再合并任意 sidecar task。
- **隔离复现**：
  1. 同一 Skill 定义 `taskA → alpha.read`、`taskB → beta.read`。
  2. taskA grounding 为 `["alpha.read"]`，taskB grounding 为 `["beta.read"]`。
  3. 无 taskId 的手动 Skill grounding 为 `[]`。
  4. `assembleCapabilityContext(... taskId:"taskA")` 的最终 grounding 仍仅为 `["alpha.read"]`。
  5. 静态接线核对确认直接执行、缺素材恢复和 Main trusted catalog 校验均存在。
- **判定**：原“跨 task 工具全集误阻断”不可复现，B7 关闭。

### B8 最终复审：CLOSED

- **实现核对**：`src/lib/skill-task-ui.js:98-139` 先记录 scene 已表示的 task identity，再追加同 `ownerPackId`、`general + empty` 且未被 scene 表示的动态 task。
- **隔离复现**：
  - 启用真实 `game-studio`，组合真实 Pack groups 与 task catalog。
  - general Pack cards 为 `docKbSuggest`、`meetingSummary`、`relatedChats`、`workflow-intake`、`todayPriority`，共 5 张。
  - `todayPriority` 为 `dynamic:true`；writing 独立回归仍返回 Pack-owned dynamic task。
- **Electron 证据核对**：
  - `skill-driven-electron-smoke.js` 已明确断言“今日优先级”且总数为 5。
  - `skill-driven-electron-smoke.json` 的 general 卡实际包含“今日优先级”；writing 四卡检查通过；15/15 checks 全部为 pass。
- **判定**：声明为 `empty` 的 Pack-owned general task 不再因缺少 scene 而丢失，B8 关闭。

### 最终检查结果

- B1–B8 隔离复现：8/8 已关闭
- 定向回归：PASS，57/57
- 全量 `npm test`：PASS，1178/1178
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- `npx openspec validate externalize-agent-capabilities-to-skills --strict`：PASS
- Electron 证据：PASS，15/15；general 5 卡含 `todayPriority`，writing 4 卡均为动态任务
- 产品代码修改：无

## Reviewer 签名

- 第二次独立复审完成
- **B1–B8 全部关闭，无 BLOCKING；代码审查通过，可进入制作人复验/QA**

## Windows atomic rename follow-up（2026-08-06）

### 复审结论

**PASS** — 未发现 BLOCKING。`renameWithRetrySync` 与随机临时文件改动保持 capability store 原有 API、payload 和同目录原子替换语义，不影响 Skill/Expert/Connector/Pack 的统一生命周期；B1–B8 关闭状态不受影响。

### 重点检查

- **同步阻塞**：生产默认仅在 `EPERM`、`EACCES`、`EBUSY` 时等待，退避为 20/50/100/200ms，最多 5 次 rename、累计最多约 370ms。该路径运行于原本已使用同步文件 I/O 的主进程持久化操作，存在短暂事件循环阻塞，但边界固定、不会无限等待，判定非阻塞风险。
- **重试边界**：不可重试错误首轮即返回；默认 `retries=4` 表示初次尝试加 4 次重试。重试耗尽后保留最后一个原始错误并由 `writeJsonAtomic` 继续抛出，不会把持久化失败伪装为成功。
- **异常清理**：最终 rename 失败时对本次随机 tmp 做 best-effort 删除；独立注入永久 `EPERM` 验证旧 `install-store.json` 保持原内容、tmp 无残留、原始 `EPERM` 向上传递。
- **原子性与数据安全**：tmp 与目标文件位于同一目录，只有成功 rename 才成为新 store；实现没有先删除目标文件，因此失败期间旧 store 始终可读。`pid + 24-bit random suffix` 降低并发/残留 tmp 名冲突，不引入外部路径输入、权限扩大或新的删除边界。
- **Windows 兼容**：针对杀毒、索引器或短暂句柄占用常见的 `EPERM/EACCES/EBUSY` 原位重试，避免通过 unlink 目标文件制造非原子空窗；Node/Electron 主进程支持使用的 `SharedArrayBuffer`/`Atomics.wait`。
- **平台兼容性**：调用面仍集中在 `saveInstallStore`，其上游覆盖统一 Connector store、Capability Hub、导入/更新与 Pack 生命周期。helper 的导出只用于可注入测试，不改变现有调用签名或 Renderer 暴露面。

### 非阻塞建议

- 当前提交的自动化回归覆盖“瞬时 `EPERM` 后成功”，尚未把“重试耗尽、不可重试错误立即停止、最终 tmp 清理且旧 store 保留”固化为长期单测；本次已用隔离临时目录独立验证这些分支。建议后续补齐，防止异常路径回归。

### 独立验证证据

- Preflight：PASS，`needs_fix=false`
- 定向回归：`node --test tests/capability-store.test.js tests/connectors.test.js`，PASS，20/20
- 隔离失败注入：`EBUSY` 在 `retries=2` 时共 3 次尝试；`ENOENT` 仅 1 次；生产默认永久 `EPERM` 共 5 次；旧 store 保留且 tmp 清理
- OpenSpec strict validate：PASS
- Harness gate：PASS，`npm test` 与 `npm run lint` 两项硬门禁均通过；报告中的软提示属于其他 active changes

### 最终判定

- **Windows atomic rename follow-up：PASS**
- **B1–B8 继续保持 CLOSED；无新增 BLOCKING**
