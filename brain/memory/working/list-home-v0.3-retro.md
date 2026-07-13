# Retro: list-home-v0.3

## 做了什么

总览从单列流水账改为左侧主题轨 + 右侧紧凑列表；行内展示 category / okfTags；版本 0.3.0。

## 有效做法

- 主题键直接复用已有 `category`，零 schema 迁移
- 标签优先 `okfTags` 回退 `tags`，与便签编辑器字段对齐
- 结构冒烟测试锁住 rail / chip / 单行预览，防回退

## 下次注意

- 历史卡片大量「未分类」时，侧栏价值依赖用户补分类或 AI 分类引导
- GUI 截图证据本版偏薄，后续 story 建议补 1–2 张侧栏截图

## 可否升 OKF

产品约定：「总览主题 = category；关闭≠删除」已在设置/对话框体现；本 retro 暂存 working，需用户确认后再 `/kb-ingest`。
