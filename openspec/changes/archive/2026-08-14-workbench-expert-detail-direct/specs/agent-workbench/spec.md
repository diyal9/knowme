## MODIFIED Requirements

### Requirement: Workbench quick expert opens expert detail
工作台任务首页的快捷专家卡 MUST 直接打开该专家的二级详情弹窗（Capability Hub `presentation=detail`，`surface=workbench`），MUST NOT 先打开能力 Hub 整页目录，MUST NOT 直接打开「安排专家执行任务」任务编排弹窗。「+ 新建任务」按钮 MUST 继续打开任务编排弹窗。

#### Scenario: Click quick expert card
- **WHEN** 用户点击任务首页已绑定专家的快捷卡片
- **THEN** 系统 SHALL 以详情叠层打开该专家二级弹窗
- **AND** 工作台主界面 SHALL 保持在叠层下方可见（不切换到能力 Hub 中心整页）
- **AND** 详情 SHALL 以 `surface=workbench` 渲染，底栏仅含开工 CTA
- **AND** MUST NOT 自动打开任务编排弹窗

#### Scenario: New task still uses composer
- **WHEN** 用户点击「+ 新建任务」
- **THEN** 系统 SHALL 打开「安排专家执行任务」弹窗
- **AND** 用户可选择专家、目标与知识库后创建并开始
