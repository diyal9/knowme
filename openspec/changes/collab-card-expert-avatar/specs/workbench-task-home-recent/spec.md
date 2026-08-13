## ADDED Requirements

### Requirement: Expert collaboration card shows expert avatar

专家协作「你的协作」最近卡片页脚 MUST 展示对应专家头像（优先预设/自定义图片），而非通用人物线框图标。头像解析 MUST 与「管理最近协作」一致：按任务 `expertId` 从已安装专家目录查找；找不到时回退语义角色图标，并仍展示专家名称与相对时间。

#### Scenario: Card footer shows expert photo

- **WHEN** 最近协作任务绑定的专家在目录中有可用头像
- **THEN** 卡片左下角展示该专家头像图，旁侧文案为「专家名 · 相对时间」

#### Scenario: Card footer falls back without photo

- **WHEN** 专家无头像或专家已从目录移除
- **THEN** 卡片左下角展示语义回退图标（非空白），旁侧仍展示专家名称与相对时间

#### Scenario: Workflow run card keeps workflow icon

- **WHEN** 卡片对应带 `workflowId` 的工作流运行
- **THEN** 页脚继续使用工作流图标，不强制替换为专家头像
