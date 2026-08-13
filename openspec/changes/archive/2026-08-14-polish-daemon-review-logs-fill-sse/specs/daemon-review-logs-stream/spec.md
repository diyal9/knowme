## ADDED Requirements

### Requirement: 过程日志区铺满审阅底部

Daemon 审阅「过程日志」Tab 中，运行日志区块 MUST 在垂直方向占用审阅正文剩余空间（铺到底），MUST NOT 使用过小的固定最大高度导致大片空白。PROGRESS.MD 摘要区 MAY 保留适度上限高度。

#### Scenario: 运行日志块拉高

- **WHEN** 用户打开 Daemon 任务并切换到「过程日志」Tab
- **THEN** 「运行日志」内容区延伸至审阅面板底部附近，其可用高度明显大于约 240px 的旧上限

### Requirement: 日志贴底跟随与上滚锁定

当用户在运行日志区内接近底部时，新增日志行 MUST 自动滚至最新；当用户上滚离开底部时，增量更新 MUST NOT 强制把滚动位置拽回底部。

#### Scenario: 贴底时跟随

- **WHEN** 日志区已贴底且有新日志行到达
- **THEN** 视口保持显示最新行

#### Scenario: 上滚时不被打断

- **WHEN** 用户上滚阅读较早日志行且仍有新行到达
- **THEN** 滚动位置保持可读，不被强制贴底

### Requirement: 会话内按任务缓存日志文本

客户端 MUST 按任务 slug 在会话内存中缓存已加载的运行日志文本（或行列表）。在缓存命中且无增量时，切换回「过程日志」Tab MUST NOT 因内容未变而整块闪烁重绘。

#### Scenario: 未变则不闪烁

- **WHEN** 轮询或重绘触发且 progress/logs 文本与上次展示相同
- **THEN** 运行日志 DOM 不因相同内容被整块替换导致闪烁（或等价跳过重绘）

### Requirement: 运行中以 SSE 增量拉取日志

任务处于非终态时，KnowMe MUST 通过 Daemon `GET /api/tasks/{slug}/logs/stream` 订阅增量日志，并将新行追加到缓存。状态轮询 MUST NOT 在 SSE 正常工作时反复请求全文 `GET /logs`。SSE 不可用时 MUST 降级为全文或尾部拉取且仍遵守贴底锁定。

#### Scenario: 运行中走 SSE

- **WHEN** 用户打开运行中的 Daemon 任务并进入过程日志（或任务开始运行）
- **THEN** 客户端建立 logs/stream 订阅，新日志行以增量形式追加到界面

#### Scenario: 轮询不再灌全文

- **WHEN** logs/stream 订阅处于活跃状态
- **THEN** 周期性任务状态刷新不重复下载整份 daemon.log 作为唯一更新手段

#### Scenario: 离开任务停止流

- **WHEN** 用户离开该任务运行间或切换到另一 slug
- **THEN** 前一 slug 的 logs/stream 订阅被停止

#### Scenario: 终态历史

- **WHEN** 任务已结束
- **THEN** 展示缓存或一次历史 `/logs` 全文，且不再保持实时 SSE
