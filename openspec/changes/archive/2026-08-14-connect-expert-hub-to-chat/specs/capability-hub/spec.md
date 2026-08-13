## ADDED Requirements

### Requirement: Expert detail starts a dedicated conversation

Capability Hub MUST 将专家详情的主操作作为进入工作的入口。主操作 MUST 根据专家状态显示为“安装并开始”“启用并开始”或“开始对话”；成功后 MUST 关闭 Hub 并请求工作区创建独立专家 Session，不得在详情抽屉内嵌第二套聊天界面。

#### Scenario: Start an installed expert

- **WHEN** 用户对已安装且已启用的专家点击“开始对话”
- **THEN** Hub 关闭并由工作区创建、激活绑定该专家的独立 Session
- **AND** 当前已有对话内容保持不变

#### Scenario: Install and start an available expert

- **WHEN** 用户对尚未安装的精选专家点击“安装并开始”
- **THEN** 系统先完成专家安装，再创建并激活绑定该专家的独立 Session
- **AND** 不要求用户安装后再次点击主操作

#### Scenario: Enable and start a disabled expert

- **WHEN** 用户对已安装但已停用的专家点击“启用并开始”
- **THEN** 系统先启用专家，再创建并激活绑定该专家的独立 Session

#### Scenario: Start action fails

- **WHEN** 安装、启用或 Session 创建任一步骤失败
- **THEN** Hub 保持可恢复状态并展示真实错误
- **AND** MUST NOT 关闭 Hub、创建空 Tab 或显示虚假成功

#### Scenario: Non-expert lifecycle actions stay unchanged

- **WHEN** 用户管理技能或连接器
- **THEN** Hub 继续提供原有安装、更新、启停与卸载操作
- **AND** MUST NOT 为技能或连接器显示专家对话主操作

## MODIFIED Requirements

### Requirement: Hub enforces dependencies and risk confirmation

安装或启用普通能力前，Hub MUST 验证 required dependencies；对 high 或 critical 风险能力 MUST 在写入状态前取得明确确认。专家安装与开始对话 MAY 在绑定技能或连接器未就绪时以 persona-only 降级模式继续，但 MUST 明确返回依赖状态，且不得因此绕过工具权限、allowlist 或审批门禁。

#### Scenario: Required dependency is unavailable for a non-expert

- **WHEN** 用户安装或启用缺少必需依赖的技能或连接器
- **THEN** 操作 MUST 被阻止
- **AND** UI SHALL 提供缺失依赖 ID 和可操作说明

#### Scenario: Expert dependency is unavailable

- **WHEN** 用户安装、启用或开始使用绑定技能/连接器未就绪的专家
- **THEN** 系统 SHALL 允许进入 persona-only 专家对话
- **AND** 新 Session SHALL 标明受限依赖及可配置入口
- **AND** 未就绪依赖对应的工具 MUST NOT 被暴露或执行

#### Scenario: User rejects high-risk confirmation

- **WHEN** 用户拒绝 high/critical 能力的风险确认
- **THEN** install store MUST 保持原状态

#### Scenario: Optional dependency is unavailable

- **WHEN** 能力仅缺少可选依赖
- **THEN** UI SHALL 显示警告但允许用户继续
