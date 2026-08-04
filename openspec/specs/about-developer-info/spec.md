# Spec: about-developer-info

> 设置 → 关于：开发者联系图标与版权。

## 开发者入口

设置 → 关于 MUST 提供开发者联系图标按钮与版权文案。

- WHEN 用户点击博客图标按钮 THEN 系统默认浏览器打开 `https://diyal9.github.io/tcloudblog/`
- WHEN 用户点击咖啡图标按钮 THEN 剪贴板写入 `diyalyin`，toast 提示喜欢冰美式（不加糖）且微信已复制
- WHEN 用户点击邮箱图标按钮 THEN 尝试打开 `mailto:670924505@qq.com`；若失败则复制邮箱并 toast
- WHEN 用户查看关于页 THEN 可见版权文案 `© 2026 KnowMe · diyal9`（非按钮）
- AND MUST NOT 单独展示微信复制图标按钮（微信通过咖啡按钮复制）

## 外链安全

- WHEN 渲染进程请求打开外链 THEN 主进程仅允许 `http:` / `https:` / `mailto:` 协议

## 来源

Synced from `openspec/changes/archive/2026-07-21-about-developer-info/specs/about-developer-info.md`
