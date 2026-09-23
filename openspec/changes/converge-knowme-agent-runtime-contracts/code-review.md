# Code Review

状态：尚未实施，尚未执行代码审查。

实现完成后的审查必须覆盖：

- 公共类型是否只在 `src/shared/api.ts` 或明确的单一 shared contract 中定义。
- V2 rejected event 是否仍存在任何正文 fallback 路径。
- planning host instruction 是否可能通过 Session/Task/attachment 再进入 execution。
- contract fingerprint 是否只包含用户需确认的语义字段。
- plan confirmation、operation approval、delivery acceptance 是否存在隐式互相转换。
- terminal/cancel/retry lineage 是否能抵御迟到事件。
- uncertain 非幂等操作是否存在自动重放路径。
- partner 与 workflow 是否被错误套用 expert 生命周期。
- 兼容 reader 是否基于 provenance/ID，而不是按纯文本删除历史。
- checkpoint、receipt、metric 和日志是否泄漏正文、参数或凭据。

审查完成后写入 reviewer、日期、发现、修复和复验结果；未执行前不得勾选 tasks H9。
