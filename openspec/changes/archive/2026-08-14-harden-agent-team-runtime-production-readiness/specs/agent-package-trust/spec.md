## Purpose

为本地与跨 Builder Agent/Team Package 提供可验证的完整性、发布者身份、权限差异和撤销契约，使生产运行不会把内容哈希误当身份认证或在信任不明时继续执行。

## ADDED Requirements

### Requirement: Full package integrity lock
系统 MUST 对规范化 manifest 与受管文件生成完整 64 位十六进制 SHA-256 内容锁，并在导入和 materialize Run 前重新计算比较。哈希只证明内容一致性，MUST NOT 被标记为发布者身份认证。

#### Scenario: Tampered package is rejected
- **WHEN** Package 内容与锁定 SHA-256 不一致
- **THEN** 系统 MUST 返回 `package_integrity_mismatch`
- **AND** MUST NOT 创建或启动 Run

#### Scenario: Legacy short hash requires migration
- **WHEN** 旧 Package 只有 16 位 legacy 内容哈希
- **THEN** 默认 strict policy MUST NOT 将其视为已验证
- **AND** 仅显式兼容策略可返回 `migration_required` 状态供用户重新锁定

### Requirement: Publisher signature verification
系统 MUST 支持 Ed25519 发布者签名，签名载荷 MUST 绑定 packageId、version、完整内容哈希和权限摘要；验签 MUST 使用显式信任策略中的发布者公钥。

#### Scenario: Trusted publisher signature passes
- **WHEN** 签名由 policy 中未撤销的可信 Ed25519 公钥产生且载荷匹配
- **THEN** 系统返回 `trustLevel=verified_publisher`
- **AND** 结果包含 publisherId、keyId 与已验证内容哈希

#### Scenario: Hash-only package has no authenticated identity
- **WHEN** 内容哈希匹配但 Package 没有发布者签名
- **THEN** 系统 MUST 返回 `trustLevel=integrity_only` 或 policy 拒绝
- **AND** MUST NOT 声称发布者已认证

### Requirement: Revocation and untrusted publishers fail closed
生产 strict policy MUST 拒绝未知发布者、未知 keyId、已撤销发布者/密钥、无效签名和签名载荷不匹配。

#### Scenario: Revoked key is rejected
- **WHEN** Package 签名 keyId 位于撤销列表
- **THEN** 系统 MUST 返回 `package_publisher_revoked`
- **AND** MUST NOT fallback 到 hash-only 信任

#### Scenario: Invalid signature is rejected
- **WHEN** Ed25519 验签失败
- **THEN** 系统 MUST 返回 `package_signature_invalid`
- **AND** MUST 记录结构化信任拒绝指标

### Requirement: Permission expansion review
Package 版本升级时系统 MUST 计算权限差异；新增工具、连接器、路径、网络、委派或副作用权限 MUST 视为权限扩大，并在运行前要求显式审阅收据。

#### Scenario: Permission expansion without receipt is blocked
- **WHEN** 新版本权限相对已批准版本扩大且没有匹配内容哈希的审阅收据
- **THEN** 系统 MUST 返回 `package_permission_review_required`
- **AND** MUST NOT 创建 Run

#### Scenario: Permission reduction does not inherit broader grant
- **WHEN** 新版本移除权限
- **THEN** 运行权限 MUST 使用新版本的更小权限集
- **AND** MUST NOT 保留旧版本已移除权限
