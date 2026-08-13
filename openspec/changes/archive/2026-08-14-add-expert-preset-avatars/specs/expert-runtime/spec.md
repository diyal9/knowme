## MODIFIED Requirements

### Requirement: EXPERT.md manifest defines expert persona

专家包 MUST 位于 `experts/<id>/`，含 `EXPERT.md`（frontmatter: name, description, avatar, skills[], connectors[], systemPrompt）及 `manifest.json`（version, contentHash）。

`avatar` 字段 MAY 为预设角色键（如 `game/engineer`、`office/writer`、`other/partner`）或兼容旧短字符串（如 `office`、`game`）；UI MUST NOT 将 emoji avatar 直出为最终视觉。

#### Scenario: Install expert from curated catalog

- **WHEN** 用户从 Hub 安装精选专家
- **THEN** 专家目录写入 capabilities/experts/
- **AND** Hub 卡片显示专家名称、描述与头像（图标或预设图）

#### Scenario: Curated experts declare preset keys

- **WHEN** 精选专家 `office-partner` / `game-studio-partner` 被加载
- **THEN** 其 avatar 可被身份层解析到办公/游戏预设头像路径
