## ADDED Requirements

### Requirement: Top tabs use path names 专家协作 / 工作流 / 管线服务

工作台顶栏 MUST 展示三个平级 Tab，用户可见文案依次为「专家协作」「工作流」「管线服务」。默认 MUST 停在「专家协作」。用户可见文案 MUST NOT 再使用顶栏「任务」或「货架」作为一级导航名。代码标识（如 `data-wb-mode="tasks"`、surface `taskhome`/`shelf`）MAY 保持不变。

#### Scenario: Default landing label

- **WHEN** 用户打开工作台
- **THEN** 顶栏显示「专家协作 / 工作流 / 管线服务」，且「专家协作」为选中态

#### Scenario: Return copy follows tabs

- **WHEN** 用户从工作流运行结束或编排页返回列表
- **THEN** 退路文案为「返回工作流」或「回到工作流」，MUST NOT 出现「货架」

### Requirement: Expert-collab page avoids bare 任务 labels

「专家协作」面用户可见分区与操作 MUST 使用「协作 / 专家」路径词（如「快捷专家」「新建协作」「最近协作」「协作目标」），MUST NOT 以裸「任务」「快捷任务」「新建任务」「最近任务」作为该面主文案。

#### Scenario: Task home copy

- **WHEN** 用户停在「专家协作」Tab
- **THEN** 可见「快捷专家」「新建协作」「最近协作」类文案，且无「货架」
