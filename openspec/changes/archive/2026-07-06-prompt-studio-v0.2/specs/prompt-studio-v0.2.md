# Spec: prompt-studio-v0.2

## product-positioning

- **WHEN** 用户首次打开应用或 README  
- **THEN** 产品 SHALL 以「AI 驱动提示词工作台 / Sticky-Notes」为主叙事，而非通用便签

## structured-editor

- **WHEN** 用户编辑一张提示词卡片  
- **THEN** 用户 SHALL 可在「结构化模式」下编辑角色/背景/任务/输出/成功标准五段，或在「自由模式」下编辑整块正文

- **WHEN** 用户在结构化模式保存  
- **THEN** 系统 SHALL 将五段拼接为 `content` 持久化，并保留 `sections` 对象供再次编辑

## version-chain

- **WHEN** 用户对卡片执行「迭代新版本」  
- **THEN** 新卡片 SHALL 记录 `parentNoteId` 指向源卡片，并继承 project/category

- **WHEN** 用户查看某卡片的版本历史  
- **THEN** 系统 SHALL 列出同版本链全部卡片，并支持任选两版查看文本 diff

## overview-classification

- **WHEN** 用户在总览面板浏览库  
- **THEN** 用户 SHALL 可按 category、okfTags、项目名、收藏筛选提示词

- **WHEN** 用户为卡片设置 category 或 okfTags  
- **THEN** 筛选结果 SHALL 实时反映变更

## memory-panel

- **WHEN** 用户打开「使用记忆」面板  
- **THEN** 系统 SHALL 展示近期使用记录（打开、复制、AI 生成、收录等）及时间摘要

- **WHEN** 用户点击一条含 `noteId` 的记忆  
- **THEN** 系统 SHALL 打开对应提示词卡片窗口

## okf-promote

- **WHEN** 用户将卡片「收录到知识库」  
- **THEN** 系统 SHALL 在 `knowledge/concepts/` 创建 OKF Concept，含 frontmatter `source_note_id` 与 `prompt_version`，并通过 lint

- **WHEN** 用户从知识库 Concept「实例化为卡片」  
- **THEN** 系统 SHALL 创建新卡片并关联 `okfConceptId`，正文来自 Concept 内容

## ai-classification-suggest

- **WHEN** 用户请求 AI 分类建议且 API 已配置  
- **THEN** 系统 SHALL 返回建议的 category 与 tags，用户确认后才写入卡片

- **WHEN** API 未配置或调用失败  
- **THEN** 系统 SHALL 提示原因且不覆盖用户已有分类

## ai-generate-regression

- **WHEN** 用户在卡片内使用 AI 生成  
- **THEN** 系统 SHALL 继续流式返回，并注入知识库摘要与记忆上下文（与 v0.1.1 行为兼容）

## editor-ux

- **WHEN** 用户在编辑器输入  
- **THEN** 编辑器 SHALL 使用等宽字体，并显示字数与 Token 粗估（本地计算）

## data-migration

- **WHEN** 应用加载 v0.1.x 旧卡片  
- **THEN** 系统 SHALL 正常打开编辑，不丢 content，新字段使用安全默认值

## release-v0.2.0

- **WHEN** 维护者发布 `v0.2.0`  
- **THEN** 应用版本号、Release notes、打包产物名称 SHALL 一致为 `0.2.0`
