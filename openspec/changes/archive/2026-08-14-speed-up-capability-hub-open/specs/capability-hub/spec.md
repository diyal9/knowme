## ADDED Requirements

### Requirement: Primary catalog is interactive before auxiliary data finishes

能力 Hub MUST 在当前 Tab 主目录数据可用后结束加载骨架并允许浏览与打开详情；编辑器装配目录、composition 索引与工作台绑定等辅助数据 MUST NOT 阻塞该主目录首屏。

#### Scenario: Main catalog paints while auxiliaries load

- **WHEN** 当前 Tab 的能力主目录请求已成功返回，但辅助数据仍在加载
- **THEN** 页面结束骨架态并展示主目录卡片
- **AND** 用户可以搜索、筛选并打开详情抽屉

#### Scenario: Auxiliaries complete without full-page skeleton

- **WHEN** 主目录已展示且辅助数据随后到达
- **THEN** 页面更新相关状态（如工作台已添加标记、编辑器候选）
- **AND** MUST NOT 重新进入整页骨架遮挡已展示的主目录
