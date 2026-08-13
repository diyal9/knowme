## MODIFIED Requirements

### Requirement: Custom skill with slash

用户 MUST 能在 **专家库**（技能 Tab → 自定义创建）新建技能并设置 `slash` 命令。创建入口 MUST 使用应用内表单/向导，MUST NOT 依赖 `window.prompt`（Electron 下不可用）。设置页旧入口 MAY 显示迁移 banner 跳转专家库。

#### Scenario: Create skill in Hub

- **WHEN** 用户在专家库技能 Tab 点击「自定义创建」
- **THEN** 打开表单可设置名称、slash 命令与 SKILL.md 正文
- **AND** 保存后写入 `%APPDATA%\KnowMe\capabilities\skills\<id>/`

#### Scenario: Legacy settings banner

- **WHEN** 用户打开设置页原技能创建入口
- **THEN** 显示已迁移到「专家库」的引导，仍可访问 legacy OKF 只读列表
