# 测试报告: Agent 专家体系完整度 / 反模式审查

- **日期**：2026-08-13
- **范围**：专家库 + Pack 场景绑定 + 官方多 Agent 工作流 + 本机安装态
- **关联 change**：`formalize-skill-catalog-coverage`（技能正式化后的专家能力完整性）
- **角色**：测试（反模式探索）；用户主动要求验证，不替代制作人正式验收签字

## 门禁

- [硬] npm test: **PASS**（1855/1855）
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: 已对照执行（数据层 + 运行时加载）
- [软] code-review: 未单独要求本轮

证据脚本：`evidence/expert-antipattern-audit.js` → `expert-antipattern-audit.json`

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| `game-studio` / `office-partner` 双包启用 | PASS | ensureDefaultPacks 后均为 enabled |
| 空状态含「今日优先级」 | PASS | 顺序：今日优先级 → 文档 → 会议 → 聊天 |
| 官方三工作流 agentRefs / skillRefs 可解析 | PASS | `wfIssues: []` |
| 已安装精选专家可 `loadExpert` | PASS | office/meeting/action/producer/developer/tester/copywriter/visual |
| Pack 场景绑定专家均可运行时加载 | **FAIL** | `game-studio-partner` 未落盘，见 BLOCKING |

## 专家清单快照

| 层 | 数量 / 内容 |
|----|-------------|
| Catalog | 9：含 `game-studio-partner` |
| Hub 列表 | 9 curated + 2 custom（`qa-copy-n1fa1g`、`test1`） |
| 已安装（install-store） | 8 curated（**缺 game-studio-partner**） |
| `loadExpert` 成功 | 10（含 2 个自建） |
| `loadExpert` 失败 | 1：`game-studio-partner` → `not_found` |

官方工作流：

| 工作流 | Agents | Skills | 结果 |
|--------|--------|--------|------|
| 会议闭环 | meeting-scribe / action-owner / office-partner | writing-polish / feishu-meeting-summary | OK |
| 三角色协作 | producer / developer / tester | code-review | OK |
| Brief 出图 | copywriter / visual-designer | writing-polish / visual-brief-prompt | OK |

## 反模式发现

### [BLOCKING] Pack 场景绑定「纸上专家」`game-studio-partner`

- **反模式**：可发现性 vs 可执行性不一致；用户从游戏场景/工作流 intake 进入，期望专家可调度
- **预期**：`game-studio` 启用后，其 `expertId=game-studio-partner` 可 `loadExpert`，任务图可拉起
- **实际**：Hub 显示 status=`available`（可浏览），但 `%APPDATA%\KnowMe\capabilities\experts\` **无该目录**；`loadExpert` → `not_found`。`game-studio` 下 6 个场景全部 `expert_unloadable`
- **证据**：`expert-antipattern-audit.json` → `loadFailures` + `sceneIssues`
- **根因**：`ensureDefaultPacks` 只装 Pack，不保证 Pack 声明的 bundled Expert 安装进专家运行时目录；`expert-runtime.loadExpert` 只读用户数据 `capabilities/experts/`，不回退 catalog

### [ADVISORY] 历史任务幽灵专家（卸载 Cursor 仓残留）

- **反模式**：状态丢失 / 打断后的脏引用
- **预期**：卸载专家后任务卡不展示不可启动的幽灵绑定，或明确「专家已移除」
- **实际**：5 条历史任务仍绑 `artbundle-expert` / `th-bi-b34eeabc8d`
- **证据**：`taskGhosts`（audit JSON）

### [ADVISORY] 自建垃圾专家污染专家库

- **反模式**：认知负担；测试残留进「我的/全部」
- **预期**：QA/空壳专家可清理或不进默认货架
- **实际**：`test1`（无 skills、body 空）、`qa-copy-n1fa1g` 仍 enabled；磁盘 `orphanDirs` 与 install 不一致感强
- **证据**：`hubExperts` / `emptySkillExperts` / `orphanDirs`

### [ADVISORY] 专家能力面偏「人设」而非「技能编排」

- **反模式**：用户以为专家卡 = 完整能力包；实际多数专家仅绑 1 个 skill（如 `office-partner`→`writing-polish`），飞书能力靠 Pack scene 注入而非 Expert.skills
- **预期**：专家详情清晰区分「场景入口 / 绑定技能 / 连接器」
- **实际**：体系可工作，但完整度叙事易误解：官方三角色 OK，游戏垂直专家却未安装
- **证据**：各 expert `manifest.json` skills 字段；scene 级 skillId 独立

### [ADVISORY] 视觉域能力「到 Prompt 为止」

- **反模式**：工作流名称「出图审阅」暗示产图，当前 `visual-brief-prompt` 仅文案/提示词
- **预期**：文案标明「产出可审阅提示词，不调用生图 API」或接官方生图 Skill
- **实际**：工作流 skillRefs 已去 Cursor 脏依赖（PASS），能力上限需产品文案对齐

## 完整度评分（测试视角）

| 维度 | 结论 |
|------|------|
| 官方办公/研发/视觉工作流可组装 | **完整** |
| 办公 Pack 空状态 + 飞书 Skill | **完整** |
| 游戏 Pack 场景 → 专家可执行 | **不完整（BLOCKING）** |
| 知识管家 Skill 挂接 | Skill 侧已补；依赖游戏专家安装后才成闭环 |
| 卸载后历史任务卫生 | **不完整（ADVISORY）** |
| 专家库货架干净度 | **一般（测试残留）** |

## 结论

- [x] **BLOCKING 已修复（2026-08-13 复测）**：`game-studio-partner` 已安装并可 `loadExpert`；`sceneIssues: []`；`loadFailures: []`
- [ ] 正式 story-done 仍建议制作人签收；ADVISORY（幽灵任务 / 空壳自建专家）可后续处理

### 修复说明（开发回修）

- `capability-pack-runtime`：`installPack` / `enablePack` / `ensureDefaultPacks` 通过 `ensureExpertInstalled` hook 同步落盘 Pack 声明 Expert
- `main.js`：hook → `installCurated`；已启用 Pack 启动时也会补装缺失专家
- 本机已执行 `installCurated(game-studio-partner)`；`npm test` **1857 PASS**，lint PASS
