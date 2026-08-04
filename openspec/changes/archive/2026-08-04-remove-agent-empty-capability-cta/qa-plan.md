# QA Plan: remove-agent-empty-capability-cta

## Smoke Scope（必填）

### Agent 空状态（核心）

- [x] 进入 Agent 工作台（无历史消息 / 新建 Session），空状态**不显示**「打开能力 Hub」或「浏览专家、技能与连接器」大卡片
- [x] 空状态显示四张任务卡片：会议总结、今日优先级、查文档/知识库、分析跟我相关的聊天
- [x] 空状态 hero 为「智能办公搭档」，副文案为「点一个任务立即开工；也可直接输入你的目标。」
- [x] 清空已有对话（或切换至无消息 Session）后，动态重绘的空状态与初始 HTML 一致（仍无 Hub 卡片、仍有四任务）

### 任务卡片行为

- [x] 点击「会议总结」→ 触发 preflight 或正常开工（已授权飞书时不应静默失败）
- [x] 点击「今日优先级」→ 同上
- [x] 点击「查文档/知识库」→ 填入对应 prompt 或 preflight 提示
- [x] 点击「分析跟我相关的聊天」→ 填入对应 prompt 或 preflight 提示
- [x] 空状态区域无 `[data-capability-hub]` 元素（DevTools 检查）

### 能力入口回归

- [x] 左侧 rail「能力」按钮仍可打开 Capability Hub overlay（默认专家 Tab）
- [x] Hub 打开/关闭后 Agent 空状态与对话区不被销毁
- [x] 设置页「打开能力 Hub」按钮仍可打开 Hub（postMessage 路径）
- [x] `npm test` 中 `workspace-capability-rail.test.js` 相关断言通过

### 其他模式空态

- [x] 知识管家 Session 空态仍为四条 steward 任务（非 Hub CTA）
- [x] 编程 / 写作 Session 空态仍为各自四任务卡片
- [x] 工作台模式空态仍为「当前工作」协作面板（非 Hub CTA）

### 门禁

- [x] `npm test` 全通过（885+）
- [x] `npm run lint` 无 error
- [x] `/gate-check` 或 `npm run harness:gate` → `blocking=false`

## Regression Scope

- [x] consolidate-capability-hub-entry：rail 单入口、Hub 三 Tab、深链、Esc 关闭不退化
- [x] agent-task-preflight-ask：办公卡片 preflight / 续跑不退化
- [x] Capability Hub 安装/启用/禁用/卸载生命周期不退化
- [x] 知识库、设置 overlay 与能力 Hub overlay 互斥行为正常

## Anti-pattern Checks（交给测试）

- [x] 快速新建/关闭多个 Agent Session，空态不出现 Hub 卡片回魂
- [x] 从 Hub overlay 关闭回到 Agent，空态布局不跳动、不重叠
- [x] 窄窗（720px / 1280px）四任务卡片仍可读可点，无 Hub 卡片占位
- [x] 空态仅输入框发送后，任务卡片消失、对话正常；清空后四卡片恢复
- [x] 设置页、文档、帮助等其它页面不应误删能力相关入口

## 证据要求

| 产物 | 路径 |
|------|------|
| 开发自测 | `evidence/dev-self-test.md` |
| UI 截图 | `evidence/screenshots/`（空态四卡片、无 Hub CTA；rail 能力入口） |
| 测试报告 | `evidence/test-report.md` |
| 代码审查 | `code-review.md`（软项） |
| 制作人验收 | `acceptance.md` |

## 门禁

- [x] `/gate-check` 或 `npm run harness:gate` → `ok=true`, `blocking=false`
