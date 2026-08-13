## ADDED Requirements

### Requirement: Renderer cache MUST NOT veto expert session start

渲染层缓存的专家目录只用于展示与取显示名，MUST NOT 作为能否开启专家会话的准入判据。当目录缓存缺失或加载失败时，启动路径 MUST 仍然把请求交给主进程，由主进程加载专家定义做权威校验。显示名取不到时 MUST 退回 expertId，MUST NOT 因此阻断启动。

#### Scenario: Catalog fetch failed but the agent exists

- **WHEN** 专家目录接口异常导致渲染层缓存为空，而该专家在主进程中真实存在
- **THEN** 系统仍然创建该专家的会话并激活
- **AND** 不向用户报告「专家不存在或尚未安装」

#### Scenario: Expert definition genuinely fails to load

- **WHEN** 主进程加载该专家定义失败（定义缺失或损坏）
- **THEN** 系统不创建会话，并把主进程返回的错因作为唯一一条失败提示反馈给用户

### Requirement: Expert session leads with the expert identity

专家会话首屏 MUST 在最显著位置呈现该专家的身份：名称、职责说明与来源徽标，并 MUST 使用与来源卡片一致的图标语义以保持视觉延续。首屏 MUST NOT 用通用产品介绍文案取代专家身份。专家的 emoji 头像字段 MUST NOT 直接渲染。

#### Scenario: Identity is visible on entry

- **WHEN** 用户从「我的智能体」卡片开始使用某 Agent 并进入对话
- **THEN** 首屏顶部显示该 Agent 的名称、职责说明与来源徽标
- **AND** 首屏不再以通用 KnowMe 介绍文案作为主视觉

### Requirement: Degraded dependencies explicitly permit conversation

当专家绑定依赖存在未就绪项时，首屏除展示受限项与「去配置」入口外，MUST 明确告知用户仍可直接对话，MUST NOT 让受限状态读起来像功能失效。

#### Scenario: Limited dependency still invites conversation

- **WHEN** 专家的某个技能或连接器未就绪
- **THEN** 首屏在能力状态区展示该受限项及原因
- **AND** 同时给出「仍可直接对话」的明确说明
