# Code review — defer-long-markdown-parse

结论：通过。`useStreamingBlocks` 终态不再全量 parse；长文 `useCommittedBlocks` 初值为空，Worker / macrotask 后再填。短文仍同步一次。

- 单测：`content-view.spec` / `content-blocks-async.spec`
- 阈值 `CONTENT_BLOCKS_WORKER_THRESHOLD = 1800`
