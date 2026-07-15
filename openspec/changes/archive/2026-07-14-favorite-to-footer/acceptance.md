# 制作人体验验收: favorite-to-footer

## 核心路径

- [x] 顶栏无收藏星；窗口控制仍为置顶 / 最小化 / 关闭  
  （契约：`topbar`/`win-btns` 不含 `btnStar`）
- [x] 底栏模式切换旁有星标，点击可切换收藏  
  （`.footer` 内 `foot-star` + `toggleFavorite`）
- [x] 收藏状态视觉（空心/实心）与既有逻辑一致  
  （`#btnStar.on` + `ico-star` outline/fill）

## 体验标准

- 顶栏更干净，收藏归内容操作区 ✅
- 底栏不挤掉 AI / 复制 ✅（星标固定 28px，meta 仍 `flex:1`）
- 无多余弹窗 ✅

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-07-14
- 备注：ADVISORY — 实机亮度对比可再看一眼；结构冒烟与单测已覆盖。
