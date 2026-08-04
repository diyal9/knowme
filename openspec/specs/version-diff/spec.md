# Spec: version-diff

## 版本选择
- WHEN 用户在有多版本的项目文件上打开「版本对比」THEN 提供该版本链内选择两个版本
- WHEN 未选满两个版本 THEN 不渲染差异

## 差异渲染
- WHEN 用户选定版本 A 与 B THEN 右侧面板渲染两版正文的行级差异（复用 note-diff）
- AND 增/删/改行有明确视觉区分
- WHEN 两版内容相同 THEN 提示「无差异」
