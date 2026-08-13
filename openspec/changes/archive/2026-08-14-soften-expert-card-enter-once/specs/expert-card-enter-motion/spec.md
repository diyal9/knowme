## ADDED Requirements

### Requirement: Softened first-enter motion for expert cards

专家库与工作台任务页的专家卡片 SHALL 使用减弱后的入场动画（接近不透明、短位移、短时长、小 stagger），且 MUST NOT 在每次切换到该页或重绘时从完全透明闪入。

#### Scenario: First catalog paint plays once

- **WHEN** 专家库首次渲染出真实专家卡片（非 loading skeleton）
- **THEN** 卡片播放一次减弱版入场动画

#### Scenario: Subsequent hub re-renders skip enter

- **WHEN** 用户筛选、切 tab 后回到专家列表、或同会话内再次打开已缓存的专家库内容导致重绘
- **THEN** 卡片以最终态直接出现，不再重播入场动画（iframe 全新加载除外）

#### Scenario: Workbench task home first paint plays once

- **WHEN** 工作台任务页首次渲染快捷专家卡片
- **THEN** 卡片播放一次减弱版入场动画；同会话后续 `renderTaskHome` 重绘不再播放

#### Scenario: Reduced motion

- **WHEN** 系统启用 `prefers-reduced-motion: reduce`
- **THEN** 不播放入场动画
