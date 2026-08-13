## ADDED Requirements

### Requirement: Expert detail supports detail-only presentation
Capability Hub MUST 支持 `presentation=detail` 呈现：隐藏目录壳层（导航、筛选、网格），仅展示专家二级详情弹窗。关闭该详情 MUST 以 `reason=detail-dismiss` 通知宿主；宿主 MUST 仅在 `drawerKind=capability-hub-detail` 时关闭透明叠层，MUST NOT 因此关闭整页专家库（`capability-hub`）。宿主以 `expertId` + `surface` + `presentation=detail` 打开时，Hub SHALL 在目录可用后自动打开对应专家详情。从 detail 叠层切回专家库整页（`presentation=hub`）时，Hub MUST 清除残留的 detail/workbench 状态。

#### Scenario: Detail presentation shows only the secondary dialog
- **WHEN** 宿主以 `presentation=detail` 打开 Capability Hub 并指定 `expertId`
- **THEN** Hub SHALL 不展示能力目录壳层
- **AND** SHALL 打开该专家的二级详情弹窗
- **AND** 关闭详情（关闭按钮 / 遮罩 / Esc）SHALL 以 `detail-dismiss` 通知宿主关闭工作台叠层

#### Scenario: Closing detail inside full expert library stays on hub
- **WHEN** 用户在整页专家库（`drawerKind=capability-hub`）打开专家详情并关闭
- **THEN** 宿主 MUST 保持专家库打开
- **AND** MUST NOT 退回工作台

## MODIFIED Requirements

### Requirement: Expert detail actions are surface-aware
Capability Hub 专家详情底栏 MUST 按打开表面（`surface`）渲染不同动作集。`surface=capability`（默认，专家库）MUST 以工作台绑定 / 撤回与编辑为主；`surface=workbench`（工作台详情叠层）MUST 仅提供开工 CTA。详情底栏 MUST 保证按钮完全可见，不得被裁切。专家本体 MUST NOT 在专家库详情提供「更新」或「卸载」。

#### Scenario: Capability surface shows management actions
- **WHEN** 用户在专家库打开已安装专家详情（`surface=capability`）
- **THEN** 未绑定时主按钮 SHALL 为「添加到工作台」
- **AND** 已绑定时主操作 SHALL 为可点击的「工作台撤回」
- **AND** 精选专家 SHALL 提供「复制为自建」
- **AND** 可编辑专家（本地/自建/已安装非精选）SHALL 提供「编辑」
- **AND** 详情底栏 MUST NOT 提供「开始对话」「安装并开始」「启用并开始」「更新」或「卸载」

#### Scenario: Workbench surface shows only start action
- **WHEN** 用户从工作台快捷专家卡打开专家详情（`surface=workbench`）
- **THEN** 底栏 SHALL 仅包含主按钮「开始对话」（或未启用时的「启用并开始」/未安装时的「安装并开始」）
- **AND** MUST NOT 显示「工作台撤回」「添加到工作台」「复制为自建」「编辑」

#### Scenario: Deep-link opens a specific expert
- **WHEN** 宿主以 `expertId` 与可选 `surface` / `presentation` 打开 Capability Hub
- **THEN** Hub SHALL 在目录加载后打开该专家详情
- **AND** 若 Hub 已打开，宿主 MAY 通过 postMessage 选中专家而无需整页重载
