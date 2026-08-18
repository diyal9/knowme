## 1. 去掉双同步解析

- [x] 1.1 `useStreamingBlocks` 在非流式时不解析
- [x] 1.2 `useCommittedBlocks` 长文不以 `parseContentBlocks` 做 useState 初值
- [x] 1.3 Worker 不可用时长文解析推迟到下一宏任务，不在调用栈上同步跑

## 2. 预热与测试

- [x] 2.1 预热 Worker（ContentView 加载时）
- [x] 2.2 测试：长文首屏 pending、不双同步解析；短文仍立刻渲染
