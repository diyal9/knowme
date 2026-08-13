# Spec: content-sources

## Purpose

定义 KnowMe 本地、GitLab、GitHub 与网页内容源的接入、同步、浏览、激活和路径安全规则，并约束 Agent 文件写入与 artifact 输出始终落在当前活跃内容源允许的作用域内。

## Source 列表
- WHEN 用户打开设置「内容源」THEN 可见已添加的 local / gitlab 源列表
- WHEN 用户添加本地文件夹 THEN 系统弹出目录选择；确认后写入 sources，且 `rootPath` 为绝对路径
- WHEN 用户移除某源 THEN 该源从列表消失；local 源不删除磁盘文件；gitlab 源可保留工作副本目录

## 路径安全
- WHEN 读取/写入文件 THEN 目标路径 MUST 落在某一 Source 的 `rootPath` 之下
- WHEN 请求路径试图穿越（`..`）THEN MUST 拒绝

## 本地源浏览
- WHEN 工作台选中 local 源 THEN 侧栏展示该目录下的文件树（忽略 `.git` / `node_modules`）
- WHEN 用户打开文本/Markdown 文件 THEN 编辑区显示内容；保存写回磁盘

## GitLab 源
- WHEN 用户配置 GitLab host + Token 并添加项目 path THEN 应用 SHALL clone 到 userData 下 `repos/` 工作副本
- WHEN 用户点击同步/pull THEN 工作副本执行 `git pull` 并更新 `lastSyncAt`
- WHEN 本机无 `git` 命令 THEN 返回可读错误，不静默失败

## 激活源
- WHEN 用户切换 activeSource THEN 工作台文件树切换到该源 `rootPath`
- AND `activeSourceId` 持久化，重启后恢复

## Requirements

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

### Requirement: Write tools bound to active content source

文件写/删/移动/patch 工具 MUST 仅作用于当前 Session 活跃内容源根；切换内容源后 MUST 重新校验 scope。

#### Scenario: Switch source invalidates pending file draft

- **WHEN** 用户切换活跃内容源且存在 pending file draft
- **THEN** 系统提示 draft 路径可能失效并需重新预览

### Requirement: Artifacts subdirectory policy

内容源 MAY 配置 `artifacts/` 为默认可写子目录；写工具 MUST 仍拒绝写入 `.git/`、`.knowme/backups` 以外系统敏感路径（由 path policy 定义）。

#### Scenario: Write to artifacts allowed

- **WHEN** 活跃源已启用 artifacts 策略
- **THEN** create_artifact 落盘 MAY 使用 `<root>/artifacts/` 无需额外批准（若 contract 标记低风险）

#### Scenario: Write to git blocked

- **WHEN** 模型试图 patch `.git/config`
- **THEN** 返回 `scope_denied`

### Requirement: Content root path resolution hardening

内容源路径解析 MUST 在写/移动/创建目录前使用 `realpath`/`lstat` 验证目标仍在绑定 root 内；symlink/junction 逃逸 MUST 返回 `scope_denied`。

#### Scenario: Parent realpath outside root

- **WHEN** 父路径 realpath 解析到 content root 外
- **THEN** 工具返回 `scope_denied`
- **AND** MUST NOT 创建或修改文件

#### Scenario: Windows junction negative test

- **WHEN** 测试 fixture 含指向 root 外的 junction
- **THEN** resolveUnderRoot MUST 拒绝
- **AND** 单测 MUST 覆盖该负例
