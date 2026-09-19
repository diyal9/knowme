# RQA83 — 通用图片预览源回退

日期：2026-09-08

## 问题

图片成果的预览入口把 `targetPath`/`meta.path` 当成唯一优先源。旧版或外部工具可能把过期本地路径、`memory://`/`artifact://` 等资源标识写入这些字段，同时在 `url`、正文或 Markdown 中提供可渲染图片地址，结果会遮蔽真实图片源并显示破图。

## 修复

`imagePreviewSource` 现在使用平台级的候选源顺序：明确的 `url`、对话中的图片 URL/data URL、再到本地文件路径。对未知 URI scheme 做边界过滤；本地路径仍交由 preload 安全解析，未放宽任意浏览器 URL 或文件访问权限。没有为生图专家增加分支。

## 验证

- `expert-image-preview.spec.tsx`：5/5，覆盖远程 URL、普通路径、stale path、opaque identifier 和正文 URL 回退。
- `artifact-preview.spec.tsx`：4/4，覆盖本地 preload 解析、远程 URL 和加载失败状态。
- `expert-task-room.spec.tsx`：68/68，覆盖真实专家房图片交付、预览弹窗、多个图片导航和失败状态。
- 三个渲染测试文件合计：77/77。

## 边界

这项修复证明通用预览源选择和失败降级更可靠，不证明外部生图 Provider 已接入，也不把图片预览回归当作生图专家的专业资格认证。
