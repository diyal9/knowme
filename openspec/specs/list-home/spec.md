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

## List row context menu

- WHEN 用户在卡片行上右键 THEN 弹出精简菜单：打开、收藏/取消收藏、删除…
- AND 不出现：复制全文、迭代新版本、复制卡片、收录到知识库、关闭窗口
- WHEN 折叠视图且该项目有多个版本 THEN 菜单额外提供「查看全部 N 个版本」，行为同「N 版」徽章
- WHEN 用户从列表右键选择删除并确认 THEN 该便签移除且列表刷新；取消则不删除
