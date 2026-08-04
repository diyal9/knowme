# 测试报告: agent-capability-hub

- **日期**：2026-08-04
- **测试人**：Tester（QA 正式接入）
- **前置**：开发自测 PASS、制作人验收 PASS（2026-08-04）
- **依据**：`qa-plan.md`、`acceptance.md`、`code-review.md`、`dev-self-test.md`、`tasks.md`

## 门禁

| 级别 | 检查项 | 结果 | 证据 |
|------|--------|------|------|
| 硬 | `npm test` | **PASS** 885/885 | 本报告 §自动化 |
| 硬 | `npm run lint` | **PASS** | lint ok + script-scope ok |
| 硬 | `npm run harness:gate` | **PASS** blocking=false | 仅 refine-assistant-fab 软项 WARN（与本 change 无关） |
| 软 | qa-plan Smoke Scope | **已执行**（静态+单测为主） | §用例矩阵 |
| 软 | code-review.md | **已完成** | 开发阶段通过 |

## 自动化

### 全量

```
npm test  → 885 pass / 0 fail / 151 suites / ~4.2s
npm run lint → ok
npm run harness:gate → Gate PASS (blocking)
```

### 定向（Capability Hub 相关）

| 测试文件 | 用例数 | 结果 | 覆盖域 |
|----------|--------|------|--------|
| `capability-store.test.js` | 5 | PASS | install CRUD、atomic write、enabled 过滤 |
| `capability-import.test.js` | 9 | PASS | traversal、symlink、secret、http、needsTrust |
| `capability-catalog.test.js` | 4 | PASS | bundled seed、overlay、filter |
| `capability-hub.test.js` | 4 | PASS | 静态 shell/grid/drawer/bridge/migrateLegacy |
| `capability-integration.test.js` | 9 | PASS | IPC 22 通道、context、迁移、session |
| `workspace-capability-rail.test.js` | 4 | PASS | rail 三图标、iframe 深链、Esc、空态 CTA |
| `skill-runtime.test.js` | 9 | PASS | L0/L1、traversal、disable-model-invocation、legacy |
| `expert-runtime.test.js` | 6 | PASS | snapshot 冻结、ephemeral DTO、bindings |
| `agent-sandbox.test.js` | 28+ | PASS | Python/Node 禁网、permissions、needsPermission |
| `mcp-host.test.js` | 6 | PASS | allowlist 投影、`mcp.<id>.` 前缀 |
| `connector-runtime.test.js` | 7 | PASS | 双 MCP 并行、feishu 草稿审批保留 |

**定向小计**：约 **91+** 用例（含 sandbox 参数化子用例），全部 PASS。

## Electron 真机冒烟（§11.3）

| 项 | 结果 | 证据 |
|----|------|------|
| 主进程启动无 uncaught error | **PASS** ⚡ | 终端 `950153.txt`：`2026-08-03T16:33:08.640Z INFO system/app-start`；仅 CSP warning |
| Renderer 无 console error（运行态） | **PASS** ⚡ | 同上；无 error 行 |
| Hub 三 Tab 真机 IPC 安装/试聊 | **未验** 🔜 | Playwright 无法驱动 Electron 窗口；未伪造点击 |
| 精选技能安装 → Agent 可见 | **未验** 🔜 | IPC 单测覆盖；真机端到端待人工 |
| 专家试聊 ephemeral 不入 Tab | **未验** 🔜 | `expert-runtime` 单测 PASS；真机待验 |

## Playwright 静态 UI（`http://127.0.0.1:18921/capability-hub.html`）

> **限制**：bridge mock fallback，**非** Electron IPC；结论仅用于 UI 契约与 console 洁净度。

| 交互 | 结果 | 备注 |
|------|------|------|
| 技能 Tab 加载 + 卡片 grid | PASS | 4 技能卡片、精选区、分类 chips |
| 点击「会议总结」→ 详情抽屉 | PASS | 版本/来源/分类/依赖/启用/更新/卸载 |
| 专家 Tab 切换 | PASS | 3 专家卡片；抽屉含「安装」「试聊专家」 |
| 连接器 Tab 切换 | PASS | 飞书/MCP/RAG；health badge；抽屉启用/卸载 |
| 搜索「飞书」过滤 | PASS | 列表收敛为飞书连接器 1 条 |
| Console messages | PASS | 0 errors / 0 warnings |
| Tab 切换时抽屉内容 | ADVISORY | 切换 Tab 后抽屉短暂保留上一 Tab 选中项，直至点击新卡片 |

## 用例矩阵（qa-plan Smoke Scope）

### Hub UI 与 Rail

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| rail 三图标 + tooltip/aria | PASS | `workspace-capability-rail.test.js` + 截图 |
| 点击图标打开 Hub 对应 Tab | PASS | rail 测试 + Playwright Tab 切换 |
| 搜索、分类 chip、「已安装」筛选 | PASS | Playwright 搜索；静态/filter 逻辑测试 |
| 三列 grid + 详情抽屉 | PASS | 截图 + Playwright 抽屉 |
| Esc/关闭回工作台 | PASS | `workspace-capability-rail` 契约测试 |
| 浅色视觉 1280px | PASS | 截图目视 + CSS 契约 |

### 安装生命周期（三类）

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| 精选技能 安装→启用→禁用→卸载 | PARTIAL | store/import 单测；**真机 Agent 可见未验** |
| 精选专家 安装→Session 绑定 | PARTIAL | integration + expert-runtime；**真机 picker 未点击** |
| 连接器 安装→health→allowlist | PARTIAL | connector-runtime 单测 + 静态抽屉；**真 MCP health 未验** |

### Skill Runtime

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| 导入标准 SKILL.md | PASS | `capability-import` + `skill-runtime` |
| list_skills 仅 L0 | PASS | `skill-runtime.test.js` |
| `/slash` 合并 SKILL + legacy | PARTIAL | integration 代码路径；**无 slash 截图/真机** |
| description 自动匹配 / disable-model-invocation | PASS | `skill-runtime` + `capability-integration` |
| legacy OKF + 迁移向导 | PASS | 静态契约 + `migrateLegacy` 接线 |
| read_skill_resource 拒绝 `../` | PASS | `skill-runtime.test.js` |

### Expert Runtime

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| 自定义创建/编辑保存 | PASS | `expert-runtime.saveExpert` |
| 试聊 ephemeral 不入 Tab | PARTIAL | `buildTryChatSession` 单测；**真机未点击** |
| Hub 编辑后旧 Session persona 不变 | PASS | snapshot 冻结用例 |
| 新 Session 用更新版本 | PASS | snapshot 哈希用例 |

### Connector Runtime

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| 双 MCP enabled 双命名空间 | PASS | `connector-runtime` + `mcp-host` |
| disable 后工具消失 | PASS | registry lifecycle 测试 |
| 飞书 JIT 卡片 | PARTIAL | feishu-auth + connector 层保留；**无 JIT 截图/对话** |
| 飞书写草稿审批 | PASS | `connector-runtime` feishu draft 用例 |

### 导入安全

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| ZIP `../` 拒绝 | PASS | `capability-import.test.js` |
| >50MB 拒绝 | ADVISORY | `capability-import.js` LIMITS 已实现；**无 dedicated 单测** |
| `http://` 拒绝 | PASS | `capability-import.test.js` |
| manifest 明文 token 拒绝 | PASS | secret scan 单测 |
| HTTPS 未知来源 needsTrust | PASS | async 单测 |

### 沙箱

| 用例 | 结果 | 验证方式 |
|------|------|----------|
| Python urllib/requests/socket block | PASS | `agent-sandbox.test.js` |
| `node -e fetch` block | PASS | `agent-sandbox.test.js` |
| run_skill_script 无 network 不外联 | PASS | `skill-runtime.runSkillScript` |
| 破坏性命令须确认 | PASS | dangerous + needsPermission |

### 回归

| 用例 | 结果 |
|------|------|
| Agent Session Tab 不退化 | PASS（885 全绿含 session 相关） |
| agent-context-assembly 意图分级 | PASS（integration assembleCapabilityContext） |
| 飞书读工具 + 单 connector MCP | PASS（connector-runtime + feishu-auth） |

## 反模式探索

| 反模式 | 结果 | 说明 |
|--------|------|------|
| 恶意 ZIP / traversal / secret / http | PASS | 单测全覆盖 |
| skill resource/script 路径越界 | PASS | `readSkillResource` + `resolveSafePath` |
| Python/Node 禁网绕过 | PASS | urllib、requests、socket、node -e 均 block |
| disable-model-invocation 自动注入 | PASS | `autoMatchSkills excludes` |
| snapshot 漂移 | PASS | expert snapshot 冻结 |
| 双 MCP 冲突 / allowlist | PASS | 前缀 + collision error |
| ephemeral 不入 tabs | PARTIAL | 单测 PASS；真机未验 |
| Renderer 不 direct fs | PASS | preload IPC 契约 + script-scope lint |
| 快速切换 Hub Tab 状态串 | ADVISORY | 抽屉保留上一 Tab 选中直到新点击 |
| 同名/id 冲突可读错误 | PASS | store/import 错误码 |
| 500+ 小文件 ZIP 拒绝 | ADVISORY | 代码 LIMITS.maxFileCount=500；无单测 |
| 窄窗抽屉无法关闭 | 未验 | 1280px 截图正常；窄窗未专门测 |

## 反模式发现详情

### [ADVISORY] Hub Tab 切换时抽屉内容短暂错位
- **反模式**：技能 Tab 选中卡片 → 切专家 Tab → 抽屉仍显示技能详情，直至点击专家卡片
- **预期**：切 Tab 时清空或重置抽屉，避免跨类型误导
- **实际**：抽屉保留上一 Tab 的选中项 DOM（Playwright snapshot 证实）
- **证据**：Playwright 静态交互 session（2026-08-04 QA）
- **影响**：非阻塞；用户点击新卡片后正常更新

### [ADVISORY] 权限升级需下轮 run 才生效
- **反模式**：沙箱工具 blocked → confirm 升级 permissions → 同轮重试仍 block
- **预期**（理想）：同 run 内热更新
- **实际**：code-review 已记录；UI 文案说明下轮生效
- **证据**：`code-review.md` §风险 1

### [ADVISORY] 真机端到端缺口（不伪造）
- 精选安装、ZIP/HTTPS needsTrust 对话框、`/slash` L1 注入目测、专家试聊、Session persona 对话、飞书 JIT 卡片、双 MCP 真机 health — **均未在本轮 QA 点击验证**；移交 `/story-done` 前可选人工补证或下 Story E2E

### [ADVISORY] >50MB / 500 文件 ZIP 缺单测
- **反模式**：qa-plan 要求拒绝超大包与 500+ 文件
- **预期**：单元测试断言
- **实际**：`capability-import.js` LIMITS 已实现；现有 import 单测未覆盖 size/count 边界
- **建议**：后续补 2 条 import 单测（非本 Story 阻塞）

## 截图证据

| 文件 | 内容 | 来源 |
|------|------|------|
| `screenshots/hub-skills.png` | 技能 Tab | 开发/制作人 Playwright |
| `screenshots/hub-experts.png` | 专家 Tab | 同上 |
| `screenshots/hub-connectors.png` | 连接器 Tab | 同上 |
| `screenshots/hub-skill-detail.png` | 技能详情抽屉 | 同上 |
| slash picker | — | **缺失** 🔜 |
| JIT 授权卡片 | — | **缺失** 🔜 |

## Blocking / Advisory 汇总

| 级别 | 数量 | 项 |
|------|------|-----|
| **BLOCKING** | **0** | — |
| **ADVISORY** | **4** | Tab 抽屉错位；权限同 run 不热更新；真机 E2E 缺口；50MB/500 文件缺单测 |

## 结论

- [x] **通过**，可进入 `/story-done`（硬门禁全绿；软项 ADVISORY 已记录）
- [ ] 不通过

**QA 判定**：**PASS**

- 885 自动化 + lint + harness:gate 全通过
- 安全/沙箱/IPC/runtime 回归充分
- 静态 Hub 三 Tab + 搜索 + 抽屉交互正常，console 洁净
- Electron 真机启动冒烟 PASS（无 uncaught error）
- 真机安装/试聊/slash/JIT 为 **ADVISORY 缺口**，不阻塞 Story 归档（与制作人放行范围一致）

**测试人**：Tester  
**日期**：2026-08-04
