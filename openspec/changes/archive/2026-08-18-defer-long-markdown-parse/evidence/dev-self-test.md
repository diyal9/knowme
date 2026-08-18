# 开发自测：defer-long-markdown-parse

日期：2026-08-18

- [x] 长文首次 paint 为 pending 纯文本，不在调用栈上 `parseContentBlocks`
- [x] 短文仍立刻 Markdown
- [x] Worker 失败/不可用时推迟到下一宏任务再解析
