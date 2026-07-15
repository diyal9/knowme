## ADDED Requirements

### Requirement: List row context menu

总览列表卡片行 SHALL 支持右键菜单，且菜单项仅对应列表已有交互能力。

#### Scenario: Right-click opens lean menu
- **WHEN** 用户在卡片行上右键
- **THEN** 系统弹出菜单，至少包含：打开、收藏/取消收藏、删除…
- **AND** 不出现：复制全文、迭代新版本、复制卡片、收录到知识库、关闭窗口

#### Scenario: Multi-version expand from menu
- **WHEN** 当前为折叠视图且该项目有多个版本
- **THEN** 菜单额外提供「查看全部 N 个版本」
- **AND** 选择后行为与点击「N 版」徽章一致（展开该项目筛选）

#### Scenario: Delete from list
- **WHEN** 用户从列表右键选择删除并确认
- **THEN** 该便签从本机移除且列表刷新
- **AND** 取消则不删除
