## MODIFIED Requirements

### Requirement: Knowledge panel in workbench

工作台 MUST 通过左侧 ribbon 底部「知识库」打开知识面板（亦可由 Agent 管家模板唤起），无需进入设置页即可浏览 Wiki / OKF 摘要列表。
知识面板 MUST 以右侧整页单列堆叠展示，MUST NOT 与 Agent/编辑区多栏并排展开。

#### Scenario: Open knowledge panel

- **WHEN** 用户打开知识面板（左侧「知识库」或管家引导）
- **THEN** 右侧整页展示知识堆叠面板（wiki / OKF 列表与预览等），且不与 Agent 对话列、文件预览列同时并排显示

#### Scenario: Close knowledge full page

- **WHEN** 用户关闭知识面板，或点击 ribbon「Agent」切回工作台
- **THEN** 退出知识全页，恢复 Agent/编辑布局

#### Scenario: Other secondary surfaces open centered

- **WHEN** 用户打开版本对比或最终提示词预览
- **THEN** 使用当前视窗居中的二级弹窗
- **AND** 不进入知识全页模式且不从右侧滑入

#### Scenario: Empty knowledge root

- **WHEN** 知识根尚无条目
- **THEN** 显示空态引导：添加 Wiki 源或执行首次 ingest，不展示长技术路径堆砌
