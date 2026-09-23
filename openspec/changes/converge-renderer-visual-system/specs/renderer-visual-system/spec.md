## ADDED Requirements

### Requirement: 结构和功能保持不变

视觉治理 SHALL 保持现有导航、布局分区、组件顺序、React 状态、路由、IPC、数据模型和业务行为。结构变化 SHALL 使用独立 proposal 并取得用户明确确认。

#### Scenario: 迁移一个页面的样式
- WHEN 开发者将硬编码值替换为共享令牌
- THEN DOM/React 结构、控件数量与顺序、事件处理和用户流程 SHALL 保持不变。

### Requirement: 统一视觉语法

渲染层 SHALL 为字体、间距、密度、控制尺寸、圆角、阴影和表面层级提供有限且命名清楚的共享令牌，feature CSS SHALL 优先消费这些令牌。

#### Scenario: 新增或调整常用视觉值
- WHEN 样式使用字体、常用间距、圆角或阴影
- THEN SHALL 复用现有语义令牌；只有组件专属几何约束 MAY 保留局部值。

### Requirement: 可量化视觉治理

仓库 SHALL 提供可重复的只读审计，统计消费者 CSS 的硬编码字体、间距、圆角、阴影和 `!important`。预算 SHALL 初始锁定实测值并只允许持平或下降。

#### Scenario: 新改动增加视觉熵
- WHEN 任一受控指标高于已提交 ceiling
- THEN `visual:check` SHALL 失败并指出超出指标。

#### Scenario: 完成一个体验域迁移
- WHEN 对应截图和行为测试通过且指标下降
- THEN ceiling SHALL 下调到新的实测值，禁止上调预算掩盖回归。

### Requirement: 能力卡片保持结构并改善层级

能力中心卡片 SHALL 保持现有网格、内容顺序、点击区域与操作语义，同时通过标题、元信息、说明和留白建立稳定的扫读层级。

#### Scenario: 在双列能力目录中浏览
- WHEN 视口可容纳双列卡片
- THEN 标题 SHALL 最突出，元信息与说明依次减弱，卡片高度和底部操作基线 SHALL 保持稳定。

### Requirement: 逐域非回退迁移

视觉系统 SHALL 按单一体验域逐批迁移。每批 SHALL 提供自动化行为证据和关键视口截图，不得同时扩大结构或功能范围。

#### Scenario: 一个迁移批次准备验收
- WHEN 自动化测试或截图显示跨域、结构或功能差异
- THEN 该批次 SHALL 停止并缩小范围或创建独立 proposal。

