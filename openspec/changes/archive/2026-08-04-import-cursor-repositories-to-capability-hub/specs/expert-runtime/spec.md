## ADDED Requirements

### Requirement: Cursor repository import produces runnable experts
仓库导入生成的 Expert MUST 使用标准 Expert Runtime 数据形态，包含稳定 ID、名称、描述、system prompt、技能绑定和连接器绑定，并可创建 Session 快照。

#### Scenario: Imported Cursor agent starts trial chat
- **WHEN** 用户对由 Cursor Agent 适配的 Expert 点击“试聊专家”
- **THEN** 系统创建包含其 persona 和已注册能力绑定的临时 Session

#### Scenario: Generated repository expert starts trial chat
- **WHEN** 用户试聊由主入口技能生成的仓库级 Expert
- **THEN** Session persona 来自主入口技能
- **AND** bindings 包含该仓库已注册技能

### Requirement: Expert bindings include only registered capabilities
适配过程中不存在、无效或未注册的技能与连接器 MUST 从可执行绑定中排除，并以预览警告呈现；系统 MUST NOT 生成指向不可用能力的静默绑定。

#### Scenario: Agent declares unknown skill
- **WHEN** Cursor Agent manifest 声明仓库中不存在的技能 ID
- **THEN** 预览显示缺失绑定警告
- **AND** 最终 Expert 的可执行 bindings 不包含该 ID

### Requirement: Reimport updates future snapshots without mutating existing snapshots
重复导入仓库更新 Expert 后，新 Session MUST 使用新版本；已经冻结的 Session 快照 MUST 保持原 persona 与绑定哈希。

#### Scenario: Expert source changes after an existing session
- **WHEN** 用户重新导入已修改的 Cursor Agent
- **THEN** 新试聊使用更新后的 Expert
- **AND** 旧 Session 继续使用原快照
