# 开发自测报告

- 日期：2026-08-18
- Change：fix-llm-first-byte-timeout
- `node --test tests/main-llm-bridge.test.js`: PASS（5/5）
- 手动冒烟: 需重启 `npm start` 后在管线任务房再发一条短消息
- 备注：本机 settings 已有 DashScope `compatible-mode/v1` + 加密 Key；超时不是「没配 API」，是首包 120s 才失败。
