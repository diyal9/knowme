## Context

参见 `proposal.md`。现有游戏工作伙伴已包含四类场景、专用提示、需求 schema、Expert、Skills 和 Daemon workflow，但能力定义分散在核心源码与目录中。Electron Renderer 禁用 Node integration；文件系统、安装和迁移必须留在主进程。能力包应成为原子能力的组合层，而不是复制 Expert、Skill 或 Connector 的运行时。

## Goals / Non-Goals

**Goals:**

- 建立轻量、版本化且可测试的 pack manifest
- 将 bundled 与本地导入 pack 统一到发现和生命周期运行时
- 在不改变旧 Session 和行业设置的前提下迁移游戏场景
- 延迟加载 pack 内容，并缓存已解析记录，控制启动 IO 与内存
- 为后续 Capability Fabric 保留清晰的组合边界

**Non-Goals:**

- 不在 pack manifest 中复制原子能力完整 schema
- 不让 Renderer 直接访问 pack 文件或 store
- 不实现远程下载、签名验证、自动更新或跨设备同步
- 不在本 change 中合并 capability install store

## Decisions

### 1. Pack manifest 仅引用原子能力 ID

`pack.json` 声明 Expert、Skill、Connector 和 Workflow ID，以及 pack 自有场景、知识种子和 UI 元数据。运行时不会复制这些原子能力的声明或执行逻辑。

选择引用而非嵌套，是为了避免形成第二套 Expert/Skill/Connector schema，并允许后续统一依赖和权限模型。备选方案是把完整能力复制进 pack，但会导致版本漂移和重复治理，因此不采用。

### 2. 独立 pack store，bundled pack 按需发现

用户状态保存在 `%APPDATA%\KnowMe\capability-packs\pack-store.json`；bundled pack 无需预先写 store 即可显示为 available。本地目录导入时复制到 `installed/<id>`，避免源目录移动后失效。

独立 store 可在不扰动现有 Capability Hub 安装逻辑的情况下验证能力包生命周期。后续 Capability Fabric 可通过适配器统一视图。备选方案是直接扩展 capability install store，但当前 store 尚无 `pack` kind，贸然合并会扩大回归面。

### 3. 主进程拥有运行时，preload 只暴露 DTO 操作

主进程负责 manifest 校验、目录复制、状态写入、路径约束和 legacy 迁移。preload 暴露 list/install/enable/disable/uninstall 等窄 API；Renderer 只消费 DTO。

这延续现有安全边界，避免 Node 文件权限泄漏给页面。

### 4. 场景解析通过已启用 pack，保留 legacy 映射

运行时按显式 scene、提示关键词、legacy mode、assist fallback 的顺序解析。旧 `industry=game` 首次启动时幂等启用 bundled `game-studio`；旧 Session 的 agentId 不改写。

这让新场景由能力包驱动，同时保持历史数据可恢复。直接迁移 Session 标识会增加不可逆数据风险，因此不采用。

### 5. 安全读取与性能边界

所有 pack 相对路径先标准化并验证仍位于 pack 根目录。目录内容哈希用于安装证据；manifest 和场景在首次使用后缓存，状态变化时清缓存。启动只扫描目录名和 `pack.json` 存在性，不预载全部知识与资源。

## Risks / Trade-offs

- [独立 pack store 暂时形成另一条生命周期存储] → 通过通用 adapter 接入后续 Capability Fabric，本阶段不让其承载原子能力状态
- [bundled pack 内容更新与旧 store 版本可能不同] → 发现时始终读取当前 manifest，store 只记录用户状态和安装证据
- [legacy 自动启用可能让用户意外看到场景] → 仅对已有明确 `industry=game` 设置执行，且支持禁用
- [第三方目录导入不含签名信任] → 本阶段只允许本地显式选择，限制路径读取；远程来源留到独立 Story

## Migration Plan

1. 发布 bundled `game-studio` pack 与通用运行时。
2. 应用启动按需读取现有 `industry` 设置；仅对 `game` 且未启用 pack 的用户写入单个 enabled 条目。
3. 旧 Session 保持原值，通过 `legacyModeMap` 运行时映射。
4. 回滚时可停止调用 pack runtime；旧设置和 Session 未被改写。pack store 是新增数据，可被旧版本忽略。
