## Context

用户确认将左侧「能力」对外命名改为「专家库」。该面仍是统一 Capability Hub（专家 / 技能 / MCP 连接器），仅改 C 端可见模块名，不改工程标识。

## Goals / Non-Goals

**Goals:**

- 一级 rail、Hub 品牌标题、宿主 drawer/iframe 标题、设置引导、工作台跳转 CTA/空态/toast 统一为「专家库」。
- 规格与静态测试锁定对外命名。
- 保留 `capability-*` 模块名与 IPC。

**Non-Goals:**

- 不改文件名、CSS class、`btnRailCapabilities` id、IPC channel。
- 不改条目级「添加能力」、表单字段「能力」、协议层 capability 错误文案。
- 不改 Hub Tab 结构与安装生命周期。

## Decisions

### 1. 对外模块名 = 「专家库」

| 位置 | 改前 | 改后 |
|---|---|---|
| rail `#btnRailCapabilities` title / label | 能力 | 专家库 |
| rail aria-label | 能力：专家、技能与 MCP 连接器 | 专家库：专家、技能与 MCP 连接器 |
| Hub / drawer / iframe / document title | 能力 Hub | 专家库 |
| 导航 CTA / 空态 / toast / 设置 | 能力界面 / 能力中心 / 能力 Hub | 专家库 |

### 2. 保留（不改）

- `添加能力`（Hub 内添加条目按钮，非专家 Tab 时）
- `<dt>能力</dt>` 等导入预览字段名
- `能力包`、能力目录/能力服务等存储与错误细节中的工程语义（若仅内部注释可不改）
- 所有 `capability-*` 标识符

### 3. 测试策略

- 更新 `tests/workspace-capability-rail.test.js` 可见标签断言。
- 新增 `tests/expert-library-naming.test.js`：rail「专家库」+ Hub 标题 + 无用户可见「能力 Hub」。
- 更新依赖旧文案的断言（如 `workbench-templates.test.js`）。

## Risks / Trade-offs

- 「专家库」略偏专家，技能/连接器 Tab 仍在页内发现——可接受，与默认 Tab 与主路径一致。
- 历史 OpenSpec change / archive 文案不回溯改写。

## Migration Plan

无数据迁移；纯文案。

## Open Questions

无。
