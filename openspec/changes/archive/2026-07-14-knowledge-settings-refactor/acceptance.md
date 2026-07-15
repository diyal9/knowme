# 制作人体验验收: knowledge-settings-refactor

## 核心路径

- [x] 打开设置 → 知识库 → 一眼看懂概念数与主题  
  （摘要行：概念数 · 校验 · 记忆；主题列表带数量）
- [x] 点概念看正文  
  （`knowledgeReadConcept` → 预览抽屉）
- [x] 勾选一主题导出  
  （`exportBundle(..., { categories })` 单测覆盖；UI 传所选）
- [x] 全选导出  
  （全选 id 列表 → `partial: false`，概念数=整库）

## 体验标准

- 界面不凌乱；文案简练 ✅
- 无多余弹窗打扰 ✅（未勾选仅 Toast）

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-07-14
- 备注：ADVISORY — 导入/实例化实机对话框依赖用户本机操作，契约与 IPC 已具备。
