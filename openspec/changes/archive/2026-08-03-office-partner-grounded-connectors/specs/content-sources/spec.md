# Delta Spec: content-sources

## ADDED Requirements

### Requirement: Content sources support GitHub repositories

系统 MUST 支持把 GitHub 仓库作为只读内容源接入，并复用现有 active source 文件浏览与读取能力。

#### Scenario: Add GitHub repository source

- **GIVEN** 用户在设置的内容源页面
- **WHEN** 用户提供 GitHub 仓库 URL（可选 branch）并确认添加
- **THEN** 系统 SHALL 拉取一个只读工作副本到 `userData/repos/`
- **AND** 在 source 列表中显示为 `github` 类型
- **AND** 用户可以像浏览 GitLab 一样浏览其文本文件

#### Scenario: Sync GitHub repository source

- **GIVEN** 已存在 GitHub 内容源
- **WHEN** 用户点击同步
- **THEN** 系统 SHALL 更新本地工作副本
- **AND** 更新 `lastSyncAt`

### Requirement: Content sources support web pages

系统 MUST 支持把普通网页抓取为只读内容源，供助手与工作台读取。

#### Scenario: Add web page source

- **GIVEN** 用户在设置的内容源页面
- **WHEN** 用户提供一个公开可访问的网页 URL
- **THEN** 系统 SHALL 抓取网页并抽取可读正文缓存到本地
- **AND** 在 source 列表中显示为 `web` 类型
- **AND** 用户可以在工作台打开该正文内容

#### Scenario: Read web page source in agent tools

- **GIVEN** 当前 active source 是网页内容源
- **WHEN** 助手调用 `read_file` / `grep_files`
- **THEN** 返回内容 MUST 来自缓存后的网页正文
- **AND** MUST NOT 直接把原始 HTML 噪声作为主要阅读内容
