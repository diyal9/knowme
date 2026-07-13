# Spec: list-home

## Theme sidebar

- WHEN 总览打开 THEN 显示侧栏：全部、收藏、各 category、未分类（含计数）
- WHEN 用户点击某主题 THEN 列表仅显示该主题（收藏为 favorite=true）
- WHEN 搜索有内容 THEN 与主题筛选叠加

## Item tags

- WHEN 卡片有 okfTags/tags THEN 行内展示最多 3 个核心标签 chip
- WHEN 有 category THEN 展示分类徽章（侧栏选中时可弱化重复）
- WHEN 无标签 THEN 不强制占位（可选灰字「未打标」）

## Density

- THEN 预览默认单行截断
- THEN promptGroup 不作为主行文案（title/tooltip 即可）
