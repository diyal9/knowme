# RQA148：专家房完整浏览器冒烟

日期：2026-09-09

## 验证内容

执行 `scripts/expert-room-browser-smoke.py`，使用隔离 API seam 加载真实 Renderer 专家房，验证页面级组合行为，而不是只验证单个 React 组件：

- 专家房和顶部主状态可见；
- 对话内容和图片成果物同时存在；
- 页面只有一个主输入框；
- 成果物区域不再额外嵌套修改输入框；
- 缩略图和预览弹窗原图均可解码；
- 缩略图和弹窗均使用 `object-fit: contain`；
- 浏览器控制台无错误。

## 结果

```json
{
  "expertRoomVisible": true,
  "composerCount": 1,
  "nestedReviewInputCount": 0,
  "primaryStatusCount": 1,
  "imagePreviewCount": 1,
  "thumbnail": { "naturalWidth": 1600, "naturalHeight": 1000, "objectFit": "contain" },
  "dialog": { "naturalWidth": 1600, "naturalHeight": 1000, "objectFit": "contain", "clientWidth": 818, "clientHeight": 661 },
  "consoleErrors": []
}
```

结论：当前专家房页面级对话、状态、图片预览和单一输入框约束同时成立。该冒烟使用本地 seam，不替代真实 Provider 和专业内容质量评审。
