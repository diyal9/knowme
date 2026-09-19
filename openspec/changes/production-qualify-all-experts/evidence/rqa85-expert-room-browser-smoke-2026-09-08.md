# RQA85：专家房真实浏览器布局冒烟

日期：2026-09-08

## 验证方式

使用 `webapp-testing` 的 `with_server.py` 启动 renderer 开发服务器，再运行仓库内的 `scripts/expert-room-browser-smoke.py`，通过真实浏览器 DOM 和图片加载状态检查专家协作页。

## 结果

```json
{
  "ok": true,
  "expertRoomVisible": true,
  "composerCount": 1,
  "nestedReviewInputCount": 0,
  "primaryStatusCount": 1,
  "imagePreviewCount": 1,
  "thumbnail": {"naturalWidth": 1600, "naturalHeight": 1000, "objectFit": "contain"},
  "dialog": {"naturalWidth": 1600, "naturalHeight": 1000, "objectFit": "contain", "clientWidth": 818, "clientHeight": 661},
  "consoleErrors": []
}
```

这次浏览器级验证确认：专家房可见；页面只有一个主输入框；验收修改区不会嵌套生成第二个输入框；顶部只有一个主状态；图片预览和放大查看均能加载真实尺寸，并使用完整展示的 `contain` 策略；浏览器控制台没有错误。

这只是代表性页面的结构与交互冒烟，不等同于全部专家的真实 Provider 执行、专业输出质量或视觉验收。外部 Provider 尚未在隔离资格环境中配置，仍需配置后重跑冻结的六专家现场资格套件。
