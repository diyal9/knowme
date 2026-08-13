## ADDED Requirements

### Requirement: Artifact store TTL and capacity

artifactStore MUST 实施 TTL（默认 7 天）与 max 200 条 LRU。过期或淘汰的 artifact id 查询 MUST 返回可读说明并建议重新生成。

#### Scenario: Expired artifact query

- **WHEN** 查询超过 TTL 的 artifact id
- **THEN** 返回 expired/not_found 与中文说明
- **AND** MUST NOT 返回空指针或未捕获异常
