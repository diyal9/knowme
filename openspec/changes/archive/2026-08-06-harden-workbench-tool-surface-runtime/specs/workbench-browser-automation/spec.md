## ADDED Requirements

### Requirement: Blocked hosts hard reject without approval path

`blockedHosts`（含 localhost、127.0.0.1、链路本地、RFC1918 私网）MUST 硬拒绝，返回 `scope_denied`。系统 MUST NOT 对 blocked 域名返回 `approval_required` 或提供用户确认绕过。

#### Scenario: Localhost hard block

- **WHEN** 模型导航到 `http://localhost:3000`
- **THEN** 返回 `code=scope_denied`
- **AND** MUST NOT 返回 `approval_required`

#### Scenario: Private IP hard block

- **WHEN** 模型导航到 `http://192.168.1.1/admin`
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 加载页面或弹出首次确认

#### Scenario: Non-blocked first visit confirm

- **WHEN** 模型导航到公网未 allowlist 域名（非 blocked）
- **THEN** MAY 返回 `approval_required` 含 host 摘要
- **AND** 用户确认后同 Run 内可继续

## MODIFIED Requirements

### Requirement: Domain allowlist and user confirmation

浏览器导航 MUST 维护域名 allowlist（默认：无）。**blockedHosts 检查 MUST 先于** allowlist/确认逻辑。首次访问非 allowlist 且非 blocked 的 http(s) 域名 MUST 暂停并请求用户确认（可「本次 Run 允许」或「加入 allowlist」）。

#### Scenario: Blocked domain

- **WHEN** 模型导航到 blocked 或私网域名
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 加载页面

#### Scenario: User approves once per run

- **WHEN** 用户选择「本次 Run 允许」example.com
- **THEN** 同 Run 内后续 example.com 导航 MAY 自动继续
