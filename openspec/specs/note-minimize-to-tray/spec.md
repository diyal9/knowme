> **SUPERSEDED** by \`reposition-ai-file-editor\` (2026-07-16). See \`openspec/specs/workspace/spec.md\` and related workspace specs.

# Spec: note-minimize-to-tray

## Toolbar minimize to tray

- WHEN 用户在便签编辑窗（全文或分段模式）点击顶栏最小化按钮
- THEN 所有应用窗口隐藏到托盘
- AND 不删除该便签文件
- AND 不自动打开总览列表

## Taskbar / restore prefers editing note

- WHEN 用户刚从某张便签最小化到托盘 AND 点击任务栏图标（或托盘显示恢复）
- THEN 首先显示并聚焦该便签编辑窗
- AND 不优先打开总览（即使存在多张便签）

## Delete still available

- WHEN 用户从总览或便签右键选择删除
- THEN 仍弹出确认并可永久删除

## Non-goals (regression)

- WHEN 用户点击 ✕ 关闭
- THEN 仍按 note-close-resume：单窗隐藏并可回总览高亮
- WHEN 托盘「隐藏全部」
- THEN 不弹总览
