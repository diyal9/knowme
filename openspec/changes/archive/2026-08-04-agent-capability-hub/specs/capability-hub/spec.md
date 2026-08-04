# Delta Spec: capability-hub

## Purpose

为 KnowMe Agent 提供统一的全屏能力管理中心，涵盖专家、技能、连接器的发现、安装、启用与生命周期管理，并保证导入安全与用户数据隔离。

## ADDED Requirements

### Requirement: Rail icon entries open Capability Hub

左侧 rail MUST 提供三个仅图标入口（专家、技能、连接器）。点击任一入口 MUST 打开同一全屏 Capability Hub，并激活对应顶部 Tab。

#### Scenario: Open Hub from skill rail icon

- **WHEN** 用户点击 rail「技能」图标
- **THEN** 全屏 Capability Hub 打开且「技能」Tab 为激活态
- **AND** 工作台主内容被 Hub 覆盖，Hub 可通过关闭按钮或 Esc 退出

#### Scenario: Deep link preserves tab

- **WHEN** 用户从 rail「连接器」图标进入 Hub
- **THEN** Hub 初始 Tab 为「连接器」，且 URL/内部路由可恢复该 Tab

### Requirement: Hub browse layout matches curated store pattern

Capability Hub MUST 提供：顶部搜索框、精选区（若有内置条目）、分类 chips、「已安装」筛选、三列响应式卡片 grid、右侧详情抽屉。视觉 MUST 采用浅色克制风格，与现有工作台 chrome 一致。

#### Scenario: Search filters cards

- **WHEN** 用户在 Hub 搜索框输入关键词
- **THEN** 当前 Tab 下卡片列表按名称/描述/标签过滤
- **AND** 无匹配时显示空状态引导

#### Scenario: Category chip filters

- **WHEN** 用户点击某分类 chip（如「写作」「飞书」）
- **THEN** 卡片列表仅显示该分类条目

#### Scenario: Installed filter

- **WHEN** 用户开启「已安装」筛选
- **THEN** 仅显示 install store 中 status 为 installed/enabled/disabled 的条目

#### Scenario: Card opens detail drawer

- **WHEN** 用户点击某能力卡片
- **THEN** 右侧抽屉展示描述、版本、来源、依赖、启用开关与安装/更新/卸载操作

### Requirement: Unified capability catalog and install store

系统 MUST 维护统一 capability catalog（内置精选 + 用户安装）与 install store。每条记录 MUST 包含：`id`, `kind`（expert|skill|connector）, `source`, `version`, `enabled`, `status`, `contentHash`, `installedAt`。

#### Scenario: Install curated skill

- **WHEN** 用户在 Hub 对精选技能点击「安装」
- **THEN** 文件复制到 `%APPDATA%\KnowMe\capabilities\skills\<id>\`
- **AND** install store 记录 status=installed
- **AND** 卡片显示「已安装」

#### Scenario: Enable and disable

- **WHEN** 用户在抽屉关闭某已安装能力的启用开关
- **THEN** install store 中 enabled=false
- **AND** Agent 运行时不再加载该能力（已绑定 Session 快照除外）

#### Scenario: Uninstall removes user copy

- **WHEN** 用户卸载某能力
- **THEN** 对应目录从 capabilities 下删除（内置 curated 仅移除 install 记录）
- **AND** install store 移除该条目

#### Scenario: Update replaces content

- **WHEN** 用户对已安装能力执行「更新」且来源有新版本
- **THEN** 原子替换目录内容并更新 version 与 contentHash

### Requirement: Multi-source import paths

Hub MUST 支持从以下来源添加能力：内置精选、本地文件夹、ZIP 包、HTTPS URL、自定义创建向导。

#### Scenario: Import local folder

- **WHEN** 用户选择本地文件夹且包含合法 manifest/SKILL.md/EXPERT.md
- **THEN** 校验通过后安装到 capabilities 对应 kind 目录

#### Scenario: Import ZIP package

- **WHEN** 用户选择 ZIP 文件
- **THEN** 系统解压到 staging、校验、安装，staging 清空

#### Scenario: Import HTTPS URL

- **WHEN** 用户输入 `https://` 开头的 ZIP 或 manifest URL
- **THEN** 下载、校验、安装
- **AND** 未知来源 MUST 经用户确认信任

#### Scenario: Custom create wizard

- **WHEN** 用户通过「自定义创建」向导新建技能/专家/连接器
- **THEN** 生成最小合法目录结构并写入 capabilities

### Requirement: Import security enforcement

导入流程 MUST 拒绝：ZIP path traversal、超限大小/文件数、非 HTTPS 远程 URL、`file://` 远程引用、软链接逃逸 capabilities 根目录。Secret MUST NOT 以明文写入磁盘。

#### Scenario: Reject zip traversal

- **WHEN** ZIP 含 `../etc/passwd` 或绝对路径条目
- **THEN** 导入失败并返回可读错误，不写入 capabilities

#### Scenario: Reject oversized package

- **WHEN** 包总大小超过 50MB 或单文件超过 10MB 或文件数超过 500
- **THEN** 导入失败

#### Scenario: Reject non-https URL

- **WHEN** 用户输入 `http://` 或 `file://` URL
- **THEN** 拒绝下载并提示仅支持 HTTPS

#### Scenario: Secrets not persisted

- **WHEN** manifest 含 API token 或 access_token 字段
- **THEN** 拒绝安装或剥离敏感字段，仅允许 `env:VAR_NAME` 引用

### Requirement: User data lives under AppData

所有 Hub 管理的已安装能力 MUST 存储在 `%APPDATA%\KnowMe\capabilities\`。Renderer MUST NOT 直接读写该路径。

#### Scenario: Main process owns IO

- **WHEN** Hub 请求安装/卸载/列表
- **THEN** 由主进程 IPC handler 读写 capabilities 目录并返回 DTO
