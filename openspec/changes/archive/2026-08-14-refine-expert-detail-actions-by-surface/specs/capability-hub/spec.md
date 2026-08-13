## ADDED Requirements

### Requirement: Expert detail actions are surface-aware
Capability Hub 专家详情底栏 MUST 按打开表面（`surface`）渲染不同动作集。`surface=capability`（默认，能力界面 / 专家库）MUST 以工作台绑定 / 撤回与编辑为主；`surface=workbench`（工作台深链）MUST 以开工为主。详情底栏 MUST 保证多按钮换行后仍完全可见，不得被裁切为仅显示单一主按钮。专家本体 MUST NOT 在专家库详情提供「更新」或「卸载」——专家 Agent 不以能力包装卸载语义下架。

#### Scenario: Capability surface shows management actions
- **WHEN** 用户在专家库打开专家详情（`surface=capability`）
- **THEN** 未绑定到当前工作模式时主按钮 SHALL 为「添加到工作台」
- **AND** 已绑定到当前工作模式时主操作 SHALL 为可点击的「工作台撤回」（不得仅显示禁用的「已在工作台」）
- **AND** 精选专家 SHALL 提供「复制为自建」
- **AND** 可编辑专家（本地/自建/已安装非精选）SHALL 提供「编辑」（不再使用「调优」文案）
- **AND** 详情底栏 MUST NOT 提供「开始对话」「安装并开始」「启用并开始」「更新」或「卸载」

#### Scenario: Workbench surface shows start actions
- **WHEN** 用户从工作台快捷专家卡深链打开专家详情（`surface=workbench`）
- **THEN** 底栏主按钮 SHALL 为「开始对话」（或未启用时的「启用并开始」/未安装时的「安装并开始」）
- **AND** 底栏 MUST NOT 提供「添加到工作台」「工作台撤回」「已在工作台」「复制为自建」「编辑」或更新/卸载

#### Scenario: Deep-link opens a specific expert
- **WHEN** 宿主以 `expertId` 与可选 `surface` 打开 Capability Hub
- **THEN** Hub SHALL 在目录加载后打开该专家详情
- **AND** 若 Hub 已打开，宿主 MAY 通过 postMessage 选中专家而无需整页重载

## MODIFIED Requirements

### Requirement: Expert can be added to the active workbench
Capability Hub SHALL 在 Expert 详情（`surface=capability`）中提供「添加到工作台」动作，并通过受限宿主消息把 Expert 标识传给工作区；该动作 MUST 作为能力面未绑定状态下的主 CTA。

#### Scenario: Add an available expert
- **WHEN** 用户在 Expert 详情点击「添加到工作台」
- **THEN** Hub SHALL 先确保 Expert 已安装且启用
- **AND** SHALL 请求宿主将该 Expert 绑定到当前工作模式
- **AND** 成功后 SHALL 显示当前工作模式名称与成功反馈

#### Scenario: Expert is already in current mode
- **WHEN** 当前 Expert 已绑定到当前工作模式
- **THEN** Hub SHALL 将主操作切换为「工作台撤回」
- **AND** 用户点击「工作台撤回」后 SHALL 请求宿主解除当前工作模式绑定
- **AND** MUST NOT 卸载专家本体或删除 Session

#### Scenario: Workbench binding fails
- **WHEN** 安装或启用已完成但工作台绑定失败
- **THEN** Hub SHALL 保留已完成的能力状态
- **AND** SHALL 显示可重试的绑定错误
- **AND** MUST NOT 错误提示已添加成功
