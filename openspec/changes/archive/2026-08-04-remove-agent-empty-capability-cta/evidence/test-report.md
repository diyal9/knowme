# 测试报告: remove-agent-empty-capability-cta

- **日期**：2026-08-04
- **测试角色**：Tester（正式 QA）
- **前置**：开发自测 PASS + 制作人验收 PASS（`acceptance.md`）+ code-review PASS（无 BLOCKING）
- **Change**：移除 Agent 空状态「打开能力 Hub」大卡片；保留四任务卡片与左侧 rail 统一能力入口

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | QA 本轮实测（Playwright 静态 HTTP 预览 / 门禁复跑 / DOM 断言） |
| 📋 | 契约或源码走查 + 既有自动化（未做 Electron 真机交互） |
| ⚡ | 继承 dev-self-test / 制作人 Electron 冒烟（QA 未重复手测） |
| ⏭ | 本轮未测（本 Story 未改 runtime / 需真机 IPC） |

---

## 门禁

| 级别 | 检查项 | 结果 | 说明 |
|------|--------|------|------|
| 硬 | `npm run harness:gate` | **PASS** | blocking=false；test + lint 均绿 |
| 硬 | `npm test` | **PASS** | 885/885（QA 独立复跑） |
| 硬 | `npm run lint` | **PASS** | harness:gate 内含 |
| 软 | qa-plan Smoke Scope | **已执行** | 见下表；真机 Session 切换项标注 📋/⚡ |
| 软 | code-review.md | **已完成** | 无 BLOCKING |

---

## Smoke 结果

### Agent 空状态（核心）

| 用例 | 结果 | 证据 |
|------|------|------|
| 空状态不显示「打开能力 Hub / 浏览专家、技能与连接器」大卡片 | ✅ PASS | Playwright DOM：`hasHubText=false`；`hubAttrCount=0`；全仓 `src/` 无 `data-capability-hub` |
| 四张任务卡片：会议总结 / 今日优先级 / 查文档·知识库 / 分析跟我相关的聊天 | ✅ PASS | DOM 四卡 `data-shortcut` 匹配；`screenshots/agent-empty-four-cards.png` |
| hero「智能办公搭档」+ 副文案「点一个任务立即开工；也可直接输入你的目标。」 | ✅ PASS | Playwright evaluate 文本断言 |
| 清空对话后动态重绘仍无 Hub、仍有四任务 | 📋 PASS | `workspace-agent.js` `renderEmptyState()` general 分支 + `!agentJs.includes('data-capability-hub')`（`workspace-capability-rail.test.js` 4/4）；Playwright 模拟清空 DOM 复现四卡无 Hub |

### 任务卡片行为

| 用例 | 结果 | 证据 |
|------|------|------|
| 点击「会议总结」→ preflight / 正常开工 | 📋 PASS | `runTaskCard(shortcutId` + `data-auto-send="1"` 处理器保留（`workspace-agent.test.js`）；⚡ Electron 继承 agent-task-preflight-ask |
| 点击「今日优先级」 | 📋 PASS | 同上 |
| 点击「查文档/知识库」 | 📋 PASS | 同上 |
| 点击「分析跟我相关的聊天」 | 📋 PASS | 同上 |
| 空状态无 `[data-capability-hub]` | ✅ PASS | Playwright + 静态契约双断言 |

### 能力入口回归

| 用例 | 结果 | 证据 |
|------|------|------|
| 左侧 rail「能力」打开 Hub overlay（默认专家 Tab） | ✅ PASS | 点击后 `drawer.open=true`、`iframe src=...tab=experts`、`aria-pressed=true`；`screenshots/workspace-rail-hub-open.png` |
| Hub 开/关后 Agent 空状态与对话区不被销毁 | ✅ PASS | Hub 打开时 `#agentChatLog` 仍含 4 张 `.agent-empty-act`；`capability-hub-close` 后 drawer 关闭 |
| 设置页「打开能力 Hub」保留（postMessage） | 📋 PASS | `settings.html` `#btnOpenCapabilityHubFromSettings` + `{ type:'open-capability-hub', tab:'skills' }` |
| `workspace-capability-rail.test.js` 4/4 | ✅ PASS | QA 定向复跑 37/37（含 rail + agent + hub 契约） |

### 其他模式空态

| 用例 | 结果 | 证据 |
|------|------|------|
| 知识管家四条 steward 任务（非 Hub CTA） | 📋 PASS | 源码 `data-steward="ingest|lint|promote|remote-rag"`；`workspace-agent.test.js` |
| 编程 / 写作各四任务卡片 | 📋 PASS | `EMPTY_SHORTCUT_PRESETS.coding/writing` 四 id；静态脚本 9/9 PASS |
| 工作台模式「当前工作」协作面板 | 📋 PASS | `agent-empty-workbench` 分支保留；无 Hub CTA |

### 门禁

| 用例 | 结果 | 证据 |
|------|------|------|
| `npm test` 885+ | ✅ PASS | QA 复跑 |
| `npm run lint` | ✅ PASS | QA 复跑 |
| harness:gate blocking=false | ✅ PASS | QA 复跑 |

---

## Regression Scope

| 用例 | 结果 | 说明 |
|------|------|------|
| consolidate-capability-hub-entry：rail 单入口、Hub 三 Tab、深链、Esc 关闭 | ✅ PASS | Playwright：rail 点击 → experts iframe；`capability-hub-close` / Esc 关闭；`capability-hub.test.js` 随全量 PASS |
| agent-task-preflight-ask：办公卡片 preflight 不退化 | 📋 PASS | `workspace-agent.test.js` preflight 断言；本 Story 未改 preflight 逻辑 |
| Capability Hub 安装/启用/禁用/卸载 | ⏭ 继承 | 未改 `capability-hub-service` / IPC；`capability-integration.test.js` 随 885 PASS |
| 知识库 / 设置 overlay 与 Hub 互斥 | 📋 PASS | `workspace.js` overlay 路由未改；继承 consolidate 行为 |

---

## 反模式探索

| 反模式 | 结果 | 备注 |
|--------|------|------|
| 快速新建/关闭 Session，空态 Hub 卡片不回魂 | 📋 PASS | 动态模板无 `data-capability-hub`；静态 + agent JS 双负向断言 |
| Hub 关闭回到 Agent，空态不跳动/不重叠 | ✅ PASS | close 后 drawer 关、四卡仍在 log 内 |
| 720px / 1280px 四任务可读可点，无 Hub 占位 | ✅ PASS | 720px：四卡宽 552px、高 74px、`allVisible=true`；`screenshots/agent-empty-720px.png` |
| 发送消息后卡片消失、清空后恢复 | 📋 PASS | `renderChat()` 空历史分支调用 `renderEmptyState()`（源码）；Playwright 注入消息后重建空态 DOM 验证 |
| 设置/文档/帮助未误删能力入口 | ✅ PASS | rail + settings 按钮均存在；空态 Hub 文案仅 settings 保留 |

### ADVISORY（不阻塞 story-done）

| 级别 | 标题 | 说明 |
|------|------|------|
| ADVISORY | 能力发现性 | 移除空态 Hub 大卡片后新用户依赖左侧 rail tooltip；design/acceptance 已接受 |
| ADVISORY | 四卡片真机点击冒烟 | QA 静态预览无完整 Electron IPC；preflight 链路继承 agent-task-preflight-ask 全量测试 + ⚡ dev-self-test |
| ADVISORY | 主 spec 待 sync | `openspec/specs/workspace/spec.md` 仍含旧 Empty state CTA 场景；归档时 `/opsx:sync` 合并 delta |
| ADVISORY | Session 模式切换空态 | steward/coding/writing 空态为源码/契约验证；未做 Electron 真机切换截图 |

**BLOCKING**：无。

---

## 截图证据

| 文件 | 说明 |
|------|------|
| `screenshots/agent-empty-four-cards.png` | Agent 空态：四任务卡、无 Hub CTA @1280px |
| `screenshots/agent-empty-720px.png` | 窄窗反模式 @720px |
| `screenshots/workspace-rail-hub-open.png` | rail「能力」→ Hub overlay（experts Tab） |

---

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**总结**：Agent 空状态 Hub 大卡片已彻底清除（静态 + 动态）；四办公任务入口与左侧 rail 统一能力入口、设置页 Hub 按钮均保留；Hub overlay 开/关不破坏空态；硬门禁 885/885 + lint + gate 全绿。**无 BLOCKING，无 FAIL。**

证据目录：`evidence/screenshots/`
