## ADDED Requirements

### Requirement: Hub starts a durable expert Session

专家详情的直接使用操作 MUST 创建普通、可持久化的独立 Session，并在创建时冻结专家 persona 与能力绑定快照。该 Session MUST 进入主 Session Tab 与历史记录，不得只返回无法被工作区激活的临时会话对象。

#### Scenario: Direct start creates an active expert Session

- **WHEN** 用户在 Hub 开始使用某专家
- **THEN** 系统创建绑定该 expertId 的普通 Session 和快照
- **AND** 工作区将该 Session 加入 Tab、设为激活态并聚焦输入框

#### Scenario: Existing conversation is not mutated

- **WHEN** 用户从已有对话打开 Hub 并开始使用另一专家
- **THEN** 系统新建独立 Session
- **AND** 原 Session 的 transcript、草稿、persona 与能力绑定保持不变

#### Scenario: Restart restores direct-start Session

- **WHEN** 用户重启 KnowMe
- **THEN** 从 Hub 创建的专家 Session 继续出现在打开 Tab 或历史记录
- **AND** 继续使用原有专家快照

### Requirement: Expert Session explains degraded dependencies

专家 Session 创建时 MUST 产出绑定依赖的就绪状态。缺失、停用或未授权依赖 MUST 作为可解释的降级信息进入 Session 展示，但 MUST NOT 阻止 persona-only 对话；运行时只可暴露当前安全策略允许且已就绪的绑定能力。

#### Scenario: Connector authorization is missing

- **WHEN** 专家绑定的连接器存在但尚未完成用户授权
- **THEN** 专家 Session 仍可创建并使用 persona 进行普通对话
- **AND** 欢迎区显示该连接器受限及“去配置”入口

#### Scenario: Bound capability is disabled

- **WHEN** 专家绑定的技能或连接器已停用
- **THEN** Session 快照记录该绑定及其未就绪状态
- **AND** 对应能力不参与当前工具或技能投影

#### Scenario: Dependency becomes unavailable after snapshot

- **WHEN** 已有专家 Session 的某绑定依赖后来被停用或卸载
- **THEN** Session 继续使用快照 persona
- **AND** 当前工具投影排除该未就绪依赖并向用户提供可解释状态

## MODIFIED Requirements

### Requirement: Cursor repository import produces runnable experts

仓库导入生成的 Expert MUST 使用标准 Expert Runtime 数据形态，包含稳定 ID、名称、描述、system prompt、技能绑定和连接器绑定，并可创建普通 Session 快照。

#### Scenario: Imported Cursor agent starts a conversation

- **WHEN** 用户对由 Cursor Agent 适配的 Expert 点击“开始对话”
- **THEN** 系统创建包含其 persona 和已注册能力绑定的普通独立 Session
- **AND** Session 进入主 Tab 与历史记录

#### Scenario: Generated repository expert starts a conversation

- **WHEN** 用户开始使用由主入口技能生成的仓库级 Expert
- **THEN** Session persona 来自主入口技能
- **AND** bindings 包含该仓库已注册且当前可用的技能

### Requirement: Expert activation validates unified dependencies

创建 Session 快照或启用 Expert 时，系统 MUST 检查 Expert 统一声明中的 required Skill 与 Connector，记录其存在、启用及授权状态。依赖问题 MUST 产生可解释的降级状态而不是阻止 persona-only Session；旧 Session 快照 MUST 继续可读，任何工具执行仍受当前安全策略约束。

#### Scenario: Expert dependency is disabled

- **WHEN** Expert 必需绑定的 Skill 或 Connector 已禁用
- **THEN** 新 Session SHALL 创建并标记对应依赖未就绪
- **AND** 该依赖对应能力 MUST NOT 进入执行投影

#### Scenario: Existing snapshot outlives dependency change

- **WHEN** 已有 Session 快照对应依赖后来被禁用
- **THEN** 快照 persona 与 binding hashes SHALL 保持可读
- **AND** 后续工具执行仍受当前安全策略约束

## REMOVED Requirements

### Requirement: Expert CRUD and try-chat in Hub

**Reason**: 临时“试聊”会创建未接入工作区的孤立对象，增加一套无法恢复的会话语义，且与用户希望直接开始工作的心智冲突。

**Migration**: 专家的创建、编辑、安装和卸载继续保留；“试聊”统一迁移为“安装并开始 / 启用并开始 / 开始对话”，并创建普通独立专家 Session。
