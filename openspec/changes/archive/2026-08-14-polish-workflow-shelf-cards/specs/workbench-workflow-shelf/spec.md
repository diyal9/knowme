## ADDED Requirements

### Requirement: Shelf cards have scannable hierarchy and card identity

货架工作流卡片 MUST 呈现可扫读的视觉层级与卡片身份：领域图标井（或等价色标）、明显高于说明/元信息的标题、压缩后的输入·产出·步数摘要，以及可运行/阻塞态的视觉区分。卡片 MUST 仍在不展开、不跳转时回答三件事：产出什么、需要什么、现在能不能跑。MUST NOT 把元信息恢复为与说明同权重的多段正文列表。

#### Scenario: Visual anchor and typography hierarchy

- **WHEN** 用户浏览货架上任意工作流卡片
- **THEN** 卡片显示领域图标井（或色标）、标题字号大于一句话说明与元信息，且来源角标仍可见

#### Scenario: Compact meta still answers three questions

- **WHEN** 用户未点击、未悬停展开卡片
- **THEN** 卡片仍直接显示产出摘要、所需输入摘要与可运行/阻塞状态（可用 chip 或等价紧凑控件），无需进入详情

#### Scenario: Blocked card remains honest

- **WHEN** 某工作流因缺少专家或其他依赖不可运行
- **THEN** 卡片有阻塞视觉态，并显示缺失摘要，且不假装可运行

### Requirement: Domain filter chips only filter the shelf locally

货架领域筛选（全部 / 办公 / 研发 / 视觉）MUST 仅在渲染层收窄货架列表。MUST NOT 在点击筛选时切换工作模式、发起模式持久化 IPC，或强制重绘编排 Studio。重复点击当前已选领域 MUST 为幂等空操作（可同步 chip 态，但 MUST NOT 重建货架 DOM）。

#### Scenario: Switching domain does not change work mode

- **WHEN** 用户在货架点击「研发」且当前工作模式不是研发
- **THEN** 货架按研发过滤，工作模式保持不变，且不弹出「已切换到…」类模式切换提示

#### Scenario: Domain switch skips studio rebuild

- **WHEN** 用户在货架表面切换领域筛选
- **THEN** 系统只更新筛选态与货架卡片，不重建 Studio 画布
