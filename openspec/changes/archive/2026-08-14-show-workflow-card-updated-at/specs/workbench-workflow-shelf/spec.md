## ADDED Requirements

### Requirement: Shelf card footer shows last updated time

货架工作流卡片 MUST 在页脚左下展示最近更新时间（相对时间），时间戳取自工作流包的更新时间，缺失时回退创建时间。有有效时间戳时 MUST 提供可访问的绝对时间提示（如悬停 title 或等价）。无有效时间戳时 MUST NOT 显示占位假日期。页脚右侧操作按钮（开始任务 / 编辑或复制）MUST 保持可用且布局不被时间文案挤压变形。

#### Scenario: Updated time visible on card footer

- **WHEN** 用户浏览货架上带有有效 `updatedAt` 或 `createdAt` 的工作流卡片
- **THEN** 卡片页脚左下显示相对更新时间（例如「更新于 3 天前」），且悬停可看到绝对日期时间

#### Scenario: Missing timestamp stays empty

- **WHEN** 某工作流包没有可解析的更新或创建时间
- **THEN** 页脚左下不显示更新时间文案，右侧操作按钮仍正常显示

#### Scenario: Footer actions remain on the right

- **WHEN** 卡片同时显示更新时间与操作按钮
- **THEN** 更新时间在左、操作按钮在右，且点击开始任务 / 编辑 / 复制行为与此前一致
