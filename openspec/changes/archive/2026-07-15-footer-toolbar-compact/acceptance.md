# 制作人体验验收: footer-toolbar-compact

## 核心路径

- [x] 左侧分段仅「文本 / MD」两钮，预览不在 mode-seg  
  （契约：`footer-toolbar-compact` 单测 + markup）
- [x] 预览在中间 `foot-tools`，与收藏/入库/分类/历史同组、紧凑图标  
  （`modeMdPreview` + `foot-tool`；纯文本 `disabled`、MD 可点逻辑未改）
- [x] 右侧 AI 助写 / 复制统一 `foot-action` 轻量描边，同高同圆角  
  （`.foot-actions` 包裹）
- [x] 元信息区仍 `flex:1`，不被工具组挤掉

## 体验标准

- 底栏分区清晰：模式 | 工具 | 状态 | 操作 ✅
- 中间工具视觉权重一致（无单独描边星标） ✅
- AI / 复制不再「厚重双框」抢注意力 ✅
- 无多余弹窗 / 无业务回归 ✅

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-07-15
- 备注：结构与单测已覆盖；实机像素级观感 ADVISORY（建议本地 `npm start` 扫一眼窄窗）。
