# Delta: slash-skill

## MODIFIED Requirements

### Requirement: Custom skill with slash

用户 MUST 能在设置知识库新建技能并设置 `slash` 命令。

创建入口 MUST 使用应用内抽屉表单，MUST NOT 依赖 `window.prompt`（Electron 下不可用）。

#### Scenario: Create skill via drawer

- **WHEN** 用户点击「新建技能」
- **THEN** 打开知识库抽屉，可填写标题、快捷命令与正文
- **WHEN** 用户确认创建
- **THEN** 技能写入 `skills/` 并可在 AI 助写 `/` 列表中出现
