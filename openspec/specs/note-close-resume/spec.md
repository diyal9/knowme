> **SUPERSEDED** by \`reposition-ai-file-editor\` (2026-07-16). See \`openspec/specs/workspace/spec.md\` and related workspace specs.

# Spec: note-close-resume

## Hide last visible note → overview

- WHEN 用户关闭（隐藏）一张有内容便签 AND 没有其它可见便签窗口 THEN 打开总览列表
- AND 总览将该便签行短暂高亮并滚动到可见

## Multi-note hide

- WHEN 关闭一张便签但仍有其它可见便签 THEN 不自动打开总览
- AND 仍记录为最近关闭，供「继续编辑」

## Tray continue

- WHEN 存在最近关闭的有效便签 id THEN 托盘菜单顶部出现「继续编辑：{名称}」
- WHEN 点击该项 THEN 重新显示并聚焦该便签
- WHEN 该便签已被删除 THEN 不显示该项

## Non-goals (regression)

- WHEN 「隐藏全部」或退出 THEN 不因本功能额外弹出总览
- WHEN 关闭空便签（丢弃） THEN 不进入「继续编辑」记录
