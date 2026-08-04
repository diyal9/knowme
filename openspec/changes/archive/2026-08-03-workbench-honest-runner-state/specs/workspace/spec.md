# Spec Delta: workspace — 任务工作间诚实状态

## ADDED Requirements

### Requirement: Runner never fakes completion when graph unavailable

工作台运行时「任务工作间」在工作流节点定义加载失败（degraded）时 MUST NOT 展示 `100%` 或 `已完成 N/N 步` 等成功进度，MUST 将 degraded 占位节点排除在进度计数外。

#### Scenario: Degraded graph shows unknown progress

- **GIVEN** Daemon 任务 `state === 'done'`，但本地无法加载该 workflow 的节点定义
- **WHEN** 任务工作间渲染进度
- **THEN** 进度 MUST 显示「无法确认进度」类文案，MUST NOT 显示 `100%` 或 `已完成 1/1 步`
- **AND** degraded 占位节点 MUST NOT 计入 `已完成 / 总步数`

#### Scenario: Consistent status semantics

- **GIVEN** 任务工作间同时渲染顶部进度、当前状态、执行节点三处
- **WHEN** 工作流加载失败
- **THEN** 三处状态语义 MUST 一致，MUST NOT 同时出现「执行中」「done · 100%」「加载失败」自相矛盾组合

### Requirement: Only real artifacts are surfaced

任务工作间与左侧助手建议 MUST 只呈现 Daemon `/artifacts` 真实返回且可打开的产物；任务**输入**路径 MUST NOT 被当作「产物」展示或推荐。

#### Scenario: Input path is not an artifact

- **GIVEN** 任务 context 含输入配置 `inputs.root = ingest/` 或 `inputs.prd = brief.md`
- **WHEN** 任务工作间渲染「任务产物」区，或左侧助手生成下一步建议
- **THEN** MUST NOT 将 `ingest/brief.md` 等输入路径列为产物或引导用户查看
- **AND** 仅当 Daemon `/artifacts` 返回该文件时才展示为产物

#### Scenario: Presenter desensitization applies to chat suggestions

- **GIVEN** 左侧助手生成含内部路径（如 `ingest/`）的建议文案
- **WHEN** 文案对 C 端用户展示
- **THEN** `presenter` 脱敏规则 MUST 生效，MUST NOT 泄露内部实现路径

### Requirement: Artifacts open reliably or fail gracefully

产物打开 MUST 先将相对路径解析到激活仓库根再打开；无法解析或文件未产出时 MUST 给出友好提示，MUST NOT 抛出系统级「文件不存在」报错。

#### Scenario: Relative artifact path resolves to repo root

- **GIVEN** Daemon 返回相对路径产物（如 `docs/report.md`）
- **WHEN** 用户点击该产物
- **THEN** 系统 MUST 以「激活仓库根 + 相对路径」解析后打开
- **AND** 路径 MUST NOT 被当作 OS 当前工作目录相对路径直接 `openPath`

#### Scenario: Ungenerated artifact gives friendly hint

- **GIVEN** 产物在本地不存在（未同步或尚未产出）
- **WHEN** 用户点击该产物
- **THEN** 系统 MUST 提示「该产物尚未生成或未同步」
- **AND** MUST NOT 弹出系统级文件缺失错误

### Requirement: Load failure has an actionable exit

工作流加载失败时，degraded 提示 MUST 对 C 端可读，并 MUST 提供跳转「设置 → 内容源」的行动入口。

#### Scenario: Actionable degraded hint

- **GIVEN** 任务工作间因激活内容源无 `.cursor/workflows/team-run.json` 而 degraded
- **WHEN** 用户查看执行节点区
- **THEN** 文案 MUST 说明可能原因（激活内容源与工作流不匹配）而非仅「无法从仓库加载节点定义」
- **AND** MUST 提供一键跳转内容源设置的入口
