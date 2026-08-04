# Design: agent-capability-hub

## Context

当前 KnowMe Agent 能力分散：

- **技能**：OKF `slash-skill` 存于 `%APPDATA%\KnowMe\knowledge\`，设置页抽屉创建；无标准 `SKILL.md` 包格式
- **连接器**：`connector-sdk` + `agent-mcp-host`，配置散落 settings；飞书 JIT auth 已在独立 change 落地
- **专家**：无一等公民；persona 靠 system prompt 层拼装

用户期望类似腾讯元器的「能力商店」体验：统一发现、安装、管理。技术约束：Electron 31 主进程持有 IO/MCP/沙箱；渲染进程仅 UI；用户数据 `%APPDATA%\KnowMe\`。

## Goals / Non-Goals

**Goals:**

- 单一 Capability Hub 全屏面对三类能力（专家 / 技能 / 连接器）
- 统一 `capabilities/` 存储与 install store 生命周期
- Skill Runtime 兼容 agentskills.io / Claude Code / Cursor 目录布局
- Expert Runtime 支持 session 版本快照
- 导入安全与沙箱禁网加固
- OKF slash skill 双轨平滑迁移

**Non-Goals:**

- 云端市场 API、计费
- 在 Hub 内运行完整代码 IDE
- 替换 OKF 知识库主路径

## Decisions

### D1: 统一存储布局

```
%APPDATA%\KnowMe\capabilities\
  catalog.json              # 内置精选索引（随应用 bundle，只读副本 + 本地 overlay）
  install-store.json        # 已安装清单、版本、enabled、source、trust
  skills/<id>/              # SKILL.md + references/ scripts/ assets/
  experts/<id>/             # EXPERT.md + manifest.json
  connectors/<id>/          # manifest + mcp config（secret 引用 env/OS keychain）
  imports/staging/          # 临时解压（安装后清空）
  snapshots/<sessionId>/    # session 绑定的 capability 版本快照（轻量 manifest 拷贝）
```

**Rationale**: 单一根目录便于备份/迁移；与 OKF `knowledge/` 分离避免污染。**Alternative**: 继续分散在 settings — 拒绝，无法统一 Hub。

### D2: 进程边界

| 职责 | 进程 |
|------|------|
| Hub UI、搜索、卡片、抽屉 | Renderer (`workspace.html`) |
| catalog 读、install/uninstall、import 校验 | Main (`capability-store.js`) |
| SKILL.md 解析、skill tools | Main (`skill-runtime.js`) |
| EXPERT.md 解析、persona 装配 | Main (`expert-runtime.js`) |
| MCP spawn、allowlist | Main (`agent-mcp-host.js`，已有) |
| 沙箱 script | Main (`agent-tool-execution.js`，已有) |

IPC 前缀：`capability:*`, `skill:*`, `expert:*`。Renderer MUST NOT 直接读 `%APPDATA%` 能力目录。

### D3: Capability Hub UI 架构

- **Shell**: 全屏 overlay，`z-index` 高于工作台；Esc / 返回关闭
- **Tab**: 专家 | 技能 | 连接器（rail 图标带 `?tab=` deep link）
- **Layout**（参考腾讯元器）:
  - 顶栏：搜索框 + Tab
  - 次级：精选 carousel（若有）+ 分类 chips + 「已安装」filter
  - 主区：响应式三列卡片 grid（≥1280 三列，窄屏两列/一列）
  - 右侧抽屉：详情（描述、版本、依赖、启用开关、安装/更新/卸载、试聊入口）
- **添加**: 顶栏「+」→ 本地文件夹 / ZIP / HTTPS URL / 自定义向导

CSS：浅色背景 `#f7f8fa`，卡片白底细边框，chip 圆角，与现有 workbench chrome 一致。

### D4: Install Store 状态机

```
available → installing → installed → enabled/disabled
                ↓ fail
              failed (保留 error)
installed → updating → installed
installed → uninstalling → removed
```

每次 mutating 操作写 `install-store.json` 前做 atomic rename（`.tmp` → 正式）。安装时拷贝/解压到 `skills|experts|connectors/<id>/` 并记录 `contentHash`、`installedAt`、`source`（curated|local|zip|https|custom）。

### D5: 导入安全

| 检查 | 规则 |
|------|------|
| ZIP traversal | 拒绝 `..`、绝对路径、Windows 设备名 |
| 大小 | 单文件 ≤ 10MB，包总 ≤ 50MB，文件数 ≤ 500 |
| HTTPS | 仅 `https://`；禁止 `file://` 远程 fetch |
| 软链接 | 解压时 skip symlink；安装路径 resolve 必须在 capabilities 根内 |
| 信任 | 首次 HTTPS/本地未知来源需用户确认「信任此来源」 |
| Secret | manifest 仅允许 `env:VAR_NAME` 占位；MUST NOT 写 token 明文 |

### D6: Skill Runtime

**包结构**（兼容 agentskills.io）:

```
skills/<id>/
  SKILL.md          # frontmatter: name, description, disable-model-invocation
  references/       # 二级披露
  scripts/          # 三级，经 run_skill_script
  assets/
```

**三级渐进披露**:

1. **L0**: `list_skills` → 仅 name + description（+ disable-model-invocation 标记）
2. **L1**: `load_skill` → SKILL.md body（截断预算内）
3. **L2**: `read_skill_resource` → references/assets 单文件
4. **L3**: `run_skill_script` → scripts/ 经沙箱，需 per-run 授权 flags

**触发**:

- 自动：`description` 与 user message 本地 embedding/keyword 匹配（无网络），top-K 注入 L0 摘要
- 手动：输入 `/` 展示合并列表（SKILL.md + 旧 OKF slash）；选中后 L1 注入

**OKF 双轨**: 启动时扫描 `%APPDATA%\KnowMe\knowledge\` 旧 slash concepts，映射为 `legacy-okf/<conceptId>` 虚拟 skill；Hub 显示「迁移」徽章；提供一键导出为标准 SKILL.md 到 `capabilities/skills/`。

### D7: Expert Runtime

**EXPERT.md** frontmatter: `name`, `description`, `avatar`, `skills[]`, `connectors[]`, `systemPrompt`

**Session 快照**: 新建/切换 Session 时，若绑定 expertId，拷贝当前 expert + 绑定 skills/connectors 的 manifest hash 到 `snapshots/<sessionId>/manifest.json`；后续对话 persona 与工具表以快照为准，Hub 内更新 expert 不影响已打开 Session。

**试聊**: Hub 抽屉内「试聊」→ 打开临时 Session（标记 `ephemeral: true`），不污染主 Session 列表。

### D8: Connector Runtime 扩展

- Curated templates：内置 feishu、mcp-generic 等模板卡片，安装后写入 `connectors/<id>/`
- 多 MCP 并行：`agent-mcp-host` 维护 `Map<connectorId, Client>`；tool 名前缀 `mcp.<connectorId>.<toolName>`
- Hub UI：health badge（绿/黄/红）、tools preview 列表、allowlist 多选
- **保留**: 飞书 JIT auth（`connector-feishu-auth`）、写草稿审批（`connector-feishu-write-review`）— 行为不变，仅入口迁移到 Hub

### D9: 沙箱禁网加固（前置任务）

已知绕过：

- Python: `urllib`, `requests`, `socket`, `http.client`
- Node: `node -e "fetch(...)"` 或 `require('http')`

**Mitigation**:

- Python: `-I` 隔离 + 自定义 wrapper 或 denylist import hook（主进程 pre-scan 脚本 AST/import）
- Node: 禁止 `-e`/`--eval`；仅允许 `-r` 指定白名单 bootstrap；或统一改用 `node script.js` 且 script 路径必须在 skill workspace 内
- Shell: 扩充 denylist（`curl`, `wget`, `nc`, `powershell Invoke-WebRequest`）
- 联网/写入/危险：skill script 调用前检查 run 级 `permissions: { network, write, dangerous }`；默认全 false

### D10: Context Assembly 集成

`agent-context-assembly` 装配顺序（assist/retrieval tier）:

1. Expert persona（来自 session 快照）
2. Skill L0 自动匹配摘要
3. `/slash` 或 `load_skill` 显式 L1 body
4. 既有 wiki/OKF/记忆

`disable-model-invocation: true` 的技能仅 `/slash` 或 UI 显式选用时可注入。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Hub 全屏遮挡工作流 | Esc 快速关闭；rail 图标记忆上次 Tab |
| 大技能包拖慢启动 | 惰性索引；catalog 仅读 manifest mtime |
| 多 MCP 内存 | 空闲 5min disconnect；Session 结束可选 teardown |
| OKF 双轨混乱 | Hub 明确分区 Legacy vs Standard；迁移向导 |
| 沙箱加固误杀合法脚本 | 显式 permission 申请 + UI 说明 |
| HTTPS 导入供应链 | 信任确认 + contentHash 展示 |

## Migration Plan

1. **Phase A**: 新建 `capabilities/` 与 Hub UI；内置精选随版本 ship
2. **Phase B**: 读取现有 connector settings → 导入 `install-store`（一次性迁移脚本，启动时）
3. **Phase C**: OKF slash 双轨只读暴露；设置页技能入口显示「已迁移到能力 Hub」banner
4. **Rollback**: 保留旧 settings 路径 30 天；`install-store` 备份 `.bak`

## Open Questions

- 精选 catalog 更新频率：随应用 release（已采纳，不做 OTA server）
- Skill 自动匹配算法：首版 keyword + 简单 TF-IDF，不上 embedding 模型（降低启动依赖）
