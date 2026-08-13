## Why

KnowMe 已支持标准 `SKILL.md`、Capability Manifest 与 Pack，但办公快捷能力仍把入口、前置检查、提示词增强和输出契约硬编码在 Renderer/主进程中。每次调整「相关聊天」「会议总结」等业务体验都要修改 KnowMe 核心，既削弱 Skill 的可移植性，也让 Cursor/Claude Code 技能无法完整承载同类工作流。

本变更把业务差异收敛到可安装 Skill/Pack，同时保留授权、审批、沙箱、工具执行与事实校验等内核安全边界，使后续业务流程和文案迭代优先通过修改 Skill 完成。

## What Changes

- 扩展标准 Skill 的可选 KnowMe sidecar 元数据，声明工具依赖、前置条件、入口展示、Prompt 增强和输出契约；纯 Cursor/Claude Code `SKILL.md` 无 sidecar 时继续按标准方式运行。
- 为 Capability Pack 增加受控的 bundled skill 发现/安装与原子依赖校验，安装 Pack 后其 Skill、场景和入口可一并生效。
- 将空状态卡片、快捷菜单和任务 preflight 改为消费统一的 Skill/Pack 入口 DTO，不再为每个业务任务新增 Renderer 常量。
- 将「相关聊天」「会议总结」「今日优先级」「查文档/知识库」及现有写作文档任务迁移为标准 Skill 包，保持现有标题、授权拦截、工具调用、输出格式与错误恢复行为。
- 保留连接器、OAuth、审批、sandbox、工具 Registry、ToolLedger/grounding 与通用 Markdown/卡片渲染在 KnowMe 内核；Skill 不得绕过这些机制。
- 为旧 Pack scene、旧 OKF slash、仅含 `SKILL.md` 的 Cursor/Claude Code 技能及已安装能力提供兼容适配和确定性回退。

## 目标用户

- **知识工作者**：安装能力后即可获得稳定入口和完整工作流，不因产品升级丢失日常办公能力。
- **Skill / Expert 作者**：可用 Cursor/Claude Code 标准目录编写技能，并通过可选 KnowMe 元数据接入工具、权限和 UI 入口。
- **企业管理员与开发者**：业务变化不再频繁触碰核心执行路径，同时安全、审批和审计仍由宿主强制执行。

## 验收标准

- 未修改业务 JS 常量，仅修改已安装 Skill 的入口或 Prompt 元数据后，对应空状态/快捷菜单和下一轮执行行为同步变化。
- 四个飞书办公入口及四个写作任务在迁移前后标题、可发现性、preflight、事实工具与主要输出契约保持兼容。
- 标准 Cursor/Claude Code Skill 的 `SKILL.md`、`references/`、`assets/`、`scripts/` 可导入、启停和运行；KnowMe 扩展元数据缺失时不影响标准兼容。
- Pack 从本地目录安装后可安全注册其 bundled skills；路径穿越、重复 ID、缺失 required connector/tool 或未确认高风险依赖被拒绝。
- 禁用/卸载 Skill 或 Pack 后，其入口和自动匹配同步消失；旧安装记录与 legacy scene 仍可读取。
- `npm test` 与 `npm run lint` 通过，新增运行时、Pack 安装、Renderer 数据驱动和现有办公能力回归测试。

## 非目标（Non-goals）

- 不把 OAuth、工具实现、审批、sandbox、ToolLedger/grounding 或安全策略下放到 Prompt。
- 不承诺新增底层工具、权限模型或全新 UI 原语时永远无需修改 KnowMe 内核。
- 不实现远程 Skill 市场、在线签名分发或自动执行未知仓库脚本。
- 不改变现有飞书 API 语义，不重做 Capability Hub 整体视觉。
- 不修改其他活跃 change 的工件；与 `harden-workbench-tool-surface-runtime` 共享的工具投影边界通过现有 Registry API 集成，不复制其实现。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-skills-runtime`: 标准 Skill 可通过可选 sidecar 声明工具、前置条件、入口与执行契约，运行时输出统一任务 DTO。
- `capability-manifest`: Skill 扩展治理元数据被验证和规范化，legacy/标准来源保持无损适配。
- `capability-pack`: Pack 可安全携带并注册标准 Skill，场景引用统一 Skill 入口且生命周期联动。
- `capability-hub`: 导入和详情展示 bundled/linked Skill 的真实来源、依赖、权限与兼容状态。
- `agent-chat-ux`: 空状态卡片、快捷菜单和确定性 preflight 由统一任务 DTO 驱动，并保留 legacy 回退。
- `office-assistant`: 既有飞书和写作办公任务由可安装 Skill 提供，迁移前后用户行为保持兼容。

## Impact

- `src/lib/skill-runtime.js`、`capability-manifest-v2.js`：Skill 扩展元数据解析、验证和统一 DTO。
- `src/lib/capability-pack-*.js`、capability store/catalog：bundled skill 安装、依赖与生命周期。
- `src/main.js`、`src/preload.js`：只读任务入口 IPC 与受控安装编排。
- `src/workspace-agent.js`：以运行时 DTO 渲染入口并执行通用 preflight/enrichment。
- `src/catalog/skills/`、`src/packs/game-studio/`：办公能力标准 Skill 与场景引用迁移。
- `tests/`：标准兼容、安全负例、入口回归与飞书/写作行为测试。
