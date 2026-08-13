## MODIFIED Requirements

### Requirement: Knowledge Web top-level naming in workspace shell
工作台左侧 rail 与知识中心顶层用户可见文案 MUST 使用「知识网」指代整体知识织网能力；个体知识库单元 MUST 继续称为「知识库 / llmwiki」，不得在本 change 中批量替换。

#### Scenario: Rail entry shows Knowledge Web label
- **GIVEN** 用户查看工作台左侧 rail
- **WHEN** 渲染 `#btnKnowledgeOs`
- **THEN** `title`、`aria-label` 与 `.rail-label` 文本均为「知识网」
- **AND** 按钮 `id` 仍为 `btnKnowledgeOs`

#### Scenario: Knowledge center opens with top-level title
- **GIVEN** 用户点击 `#btnKnowledgeOs`
- **WHEN** 知识中心以 center surface 打开
- **THEN** drawer 顶层标题为「知识网」（非「知识库」）
- **AND** 首页 kicker 或整体定位语体现「懂你的知识网」

#### Scenario: Individual library terms unchanged
- **GIVEN** 用户进入知识中心连接页或本地库视图
- **WHEN** 渲染个体库相关 UI
- **THEN** 仍可见「本地知识库」「添加知识库」等个体用词
- **AND** AI 提示词与 `feishu-*` 文件中「知识库」未被本 change 修改
