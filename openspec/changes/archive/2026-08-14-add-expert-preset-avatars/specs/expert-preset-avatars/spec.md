## Purpose

为专家提供少量 KnowMe 风格扁平预设头像，并在身份呈现层统一解析与回退。

## Requirements

### Requirement: Preset avatar catalog is finite and packaged

系统 MUST 在 `src/assets/avatars/` 提供有限预设 PNG（256px）及 `catalog.json`，覆盖 game/office/other 三大类；游戏侧可含制作/策划/客户端/服务端/UI/特效/测试等锚点，MUST NOT 默认捆绑数十张工种图鉴。

#### Scenario: Catalog lists finite presets

- **WHEN** 读取 `src/assets/avatars/catalog.json`
- **THEN** presets 含 `game/client`、`game/server`、`game/planner`、`game/ui`、`game/vfx`
- **AND** 含 `other/partner` 作为 fallback

### Requirement: Identity layer resolves avatar src

`AgentIdentity` MUST 暴露解析函数：根据 agent 的 `avatar` 字段与名称/描述语义返回预设相对路径；无法解析时返回空字符串，由 UI 回退语义图标。

#### Scenario: Explicit role key

- **WHEN** agent.avatar 为 `office/writer` 或 `writer`
- **THEN** 解析结果指向 `assets/avatars/office/writer.png`

#### Scenario: Semantic fallback for office partner

- **WHEN** agent 名称/描述含「写作」「办公」等办公语义且无显式有效键
- **THEN** 解析到 office 类预设之一或显式 catalog 匹配

#### Scenario: Unknown avatar does not throw

- **WHEN** avatar 为未知字符串或 emoji
- **THEN** 解析不抛错，最终可回退 `other/partner` 或空（由实现选择其一，但 MUST 保持 UI 可渲染）

### Requirement: Expert session identity can render preset image

会话专家身份区 MUST 在解析到非空 src 时渲染 `<img>` 头像；否则 MUST 继续使用语义 SVG 图标。

#### Scenario: Image mark in identity strip

- **WHEN** 当前 Session 绑定的专家可解析到预设头像
- **THEN** 身份区标记为图片而非仅 data-icon

### Requirement: Hub applies preset avatars as system default presentation

能力 Hub 的专家卡片、精选区与详情抽屉 MUST 使用身份层解析出的预设图（或语义图标回退）。创建/调优专家时 MUST 提供预设头像选择，并 MUST 支持按名称、职责说明与已选 Skill 自动匹配；保存时 MUST 将角色键写入 `avatar` 字段。

#### Scenario: Create expert auto-matches avatar

- **WHEN** 用户新建专家并填写名称「客户端工程师」
- **THEN** 头像选择器自动选中 `game/client`（除非用户已手动改选）

#### Scenario: Manual avatar override persists

- **WHEN** 用户在创建表单中手动点选 `game/ui` 并保存
- **THEN** EXPERT.md 的 avatar 为 `game/ui`
- **AND** Hub 卡片显示对应预设图
