# RQA89 — 专家房浏览器回归

日期：2026-09-08

## 执行

按 `webapp-testing` 规范使用 `with_server.py` 启动本地 Vite，并运行 `scripts/expert-room-browser-smoke.py`。测试使用隔离的浏览器 API seam 与本地图片，不调用远程 Provider。

## 结果

```json
{
  "ok": true,
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

## 判定

专家房当前满足：单一主输入框、状态区域不重复、图片真实可预览、原图弹窗按视口适配、浏览器控制台无错误。该证据覆盖 UI 回归，不替代远程 Agent 专业资格和图片 Provider 真实执行证据。
