## ADDED Requirements

### Requirement: Skill detail offers a first-run entry

技能详情 MUST 展示该技能声明的可用任务，任务数据 MUST 来自 display-safe 的任务目录，MUST NOT 展示技能目录路径、脚本路径等实现细节。已安装的技能 MUST 提供「试用」入口：点击后在对话中开启一个新会话，并把所选任务的提示词预填到输入框，交由用户确认后再发送，MUST NOT 自动发送。技能未声明任何任务时 MUST 给出说明文案而不是留空。技能尚未安装时，试用入口 MUST 先完成安装与启用再开启对话；其中任一步失败时 MUST 保留详情打开状态并给出失败原因。

#### Scenario: Try an installed skill from its detail

- **WHEN** 用户打开一项已安装技能的详情并点击某个任务的「试用」
- **THEN** 能力界面关闭并在对话区出现一个新会话
- **AND** 输入框预填该任务的提示词且获得焦点，消息尚未发送

#### Scenario: Skill without declared tasks

- **WHEN** 用户打开的技能没有声明任何任务
- **THEN** 详情中的任务区显示说明文案，告知该技能由专家或对话按需调用
- **AND** 详情的其余区块与安装、卸载操作不受影响

#### Scenario: Trying an uninstalled skill

- **WHEN** 用户对尚未安装的技能点击「试用」
- **THEN** 先执行安装与启用，再开启预填提示词的新会话
- **AND** 安装或开启失败时详情保持打开并显示失败原因

### Requirement: Capability composition is visible from both sides

专家详情 MUST 展示它已装配的技能与连接器；技能详情 MUST 展示已装配该技能的专家。两侧列出的条目 MUST 可点击，点击后 MUST 切换到对应类型并打开该条目的详情。当装配信息无法获取（例如能力尚未安装到本地）时 MUST 显示说明文案，MUST NOT 显示空白或报错。

#### Scenario: Inspect what an expert is made of

- **WHEN** 用户打开一位已安装专家的详情
- **THEN** 详情中显示该专家装配的技能与连接器清单
- **AND** 点击其中一项技能会切换到技能页并打开该技能的详情

#### Scenario: Inspect who uses a skill

- **WHEN** 用户打开一项技能的详情
- **THEN** 详情中显示已装配该技能的专家清单
- **AND** 没有任何专家装配它时显示说明文案

#### Scenario: Composition unavailable for a not-yet-installed expert

- **WHEN** 用户打开一位尚未安装的精选专家的详情
- **THEN** 装配区显示「安装后可查看」类说明文案
- **AND** 安装与开始对话操作仍可正常使用

### Requirement: Risk and trust confirmations happen in-app

安装预检、高风险能力确认、未知来源信任确认与旧技能迁移 MUST 使用应用内对话框，MUST NOT 使用浏览器原生 `confirm` 或 `prompt`。确认对话框 MUST 展示已获得的决策依据（风险等级与依据、依赖问题、兼容性结论、成本估计中可用的部分），MUST 支持键盘确认与 Escape 取消，且 MUST 在关闭后把焦点交还给触发它的控件。用户取消时 MUST NOT 产生安装、启用或迁移副作用。

#### Scenario: Confirm a high-risk install

- **WHEN** 用户安装一项被标记为高风险的能力
- **THEN** 应用内对话框列出风险等级与风险依据，并要求显式确认
- **AND** 用户取消时该能力保持未安装状态

#### Scenario: Cancel with the keyboard

- **WHEN** 确认对话框打开且用户按下 Escape
- **THEN** 对话框关闭且操作被取消
- **AND** 焦点回到触发该对话框的按钮

#### Scenario: Migrate a legacy skill

- **WHEN** 用户对旧版技能选择「迁移为标准技能」
- **THEN** 应用内对话框请求新的技能 ID 并给出默认值
- **AND** 用户取消时不产生任何迁移输出
