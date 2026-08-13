# 测试报告

- 日期：2026-08-06
- Change：`hide-unstable-agent-stream-content`
- 结论：PASS，可进入 Story 完成门禁

## 门禁结果

- `npm test`：PASS（1278/1278）
- `npm run lint`：PASS
- OpenSpec strict validate：PASS
- Electron smoke：PASS（12/12）
- qa-plan Smoke Scope：PASS（8/8）

## 核心验证

- 半行标题、代码围栏、链接、表格不显示原始 Markdown。
- thinking / suggestion / JSON 协议片段不进入可见文本或 HTML。
- 稳定标题、列表、表格直接渲染为最终节点。
- pending 仅包含固定「正在整理…」状态。
- 取消时仅保留稳定内容，未完成链接不在终态泄漏。
- 完成前后气泡与正文容器节点身份保持。
- V2 经真实 preload/IPC 路径提交并保持正文容器。
- 用户上滑后更新滚动漂移：0 px（阈值 < 8 px）。

## 反模式检查

- 原始 tail 写入 DOM：未发现。
- CSS 假隐藏原始内容：未发现。
- 全量重建聊天列表：未发现。
- legacy/V2 分叉导致原文泄漏：未发现。
- 取消后暴露半截内容：未发现。

## ADVISORY

- 无换行长句会在完成前保持缓冲，这是产品已接受的稳定性优先策略。
- 非标准无尾竖线表格按普通文本处理，不属于当前 Markdown 表格语法。
