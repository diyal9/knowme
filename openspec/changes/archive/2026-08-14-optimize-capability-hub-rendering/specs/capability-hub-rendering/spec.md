## Purpose

为能力 Hub 提供稳定、及时的搜索反馈和有限时长的卡片入场效果，避免能力目录增长后出现可感知的等待或输入迟滞。

## ADDED Requirements

### Requirement: Search feedback is coalesced

能力 Hub MUST 合并连续的搜索输入，只在用户短暂停止输入后更新筛选结果。

#### Scenario: User types a search phrase continuously

- **WHEN** 用户在搜索框中连续输入多个字符
- **THEN** 页面在短暂输入间隔内不会为每个字符立即重复重绘目录，并在输入暂停后展示最新匹配结果

#### Scenario: User clears the search field

- **WHEN** 用户清空搜索框
- **THEN** 页面在同样的调度规则下恢复完整目录，且精选区和结果计数同步更新

### Requirement: Catalog entrance animation remains bounded

能力 Hub MUST 将精选卡片和目录卡片的单项入场延迟限制在 300ms 以内，并在用户启用 reduced-motion 时保持无明显动画。

#### Scenario: Catalog contains many entries

- **WHEN** 目录渲染的卡片数量超过少量首屏条目
- **THEN** 任一卡片的入场延迟不超过 300ms，用户无需等待长时间的逐项动画才能看到目录

#### Scenario: User prefers reduced motion

- **WHEN** 系统的 `prefers-reduced-motion` 设置为 reduce
- **THEN** 卡片不执行持续的渐入动画，且目录内容仍正常显示和可交互
