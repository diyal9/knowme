## Why

KnowMe 已经具备游戏工作室场景、需求模板、专家与技能，但这些能力仍以产品内分支和零散目录存在，难以作为一个可发现、可安装、可启停、可迁移的垂直能力单元复用。把它们提取为标准能力包，可以验证“核心工作台 + 行业能力包”的产品架构，并为后续团队分发和 Capability Fabric 打下组合层基线。

## What Changes

- 新增通用 capability pack manifest、校验、存储与运行时，支持发现、安装、启停、卸载和第三方目录导入
- 将游戏研发专家、技能、场景、需求 schema、知识种子和工作流声明为 `game-studio` 能力包
- 将场景识别、空状态分组和 legacy 游戏行业设置迁移到能力包运行时
- 暴露最小 Electron IPC / preload API，保持 Renderer 无 Node 权限
- 保留旧游戏场景兼容路径，但运行时优先使用已启用能力包

## 目标用户

- 希望 KnowMe 直接理解策划、研发、测试和制作流程的游戏工作室成员
- 希望为团队打包和分发行业 Agent、Skill、知识与工作流的能力作者

## 验收标准

- `game-studio` 可从 bundled packs 被发现并安装，启停状态持久化
- 安装后四个游戏场景出现在工作伙伴空状态，并能产生对应场景提示
- 旧 `industry=game` 用户可幂等迁移，不重复安装或丢失行为
- 第三方最小能力包无需修改核心代码即可导入
- 路径穿越、无效 manifest 和缺失依赖被明确拒绝
- 完整测试、lint 与 Electron 主进程启动通过

## 非目标（Non-goals）

- 不在本 Story 中增加能力 Hub 的“能力包”Tab
- 不把 pack store 与 capability install store 物理合并
- 不实现远程能力市场、签名验证或自动更新
- 不重构 Agent executor 或 MCP transport

## Capabilities

### New Capabilities

- `capability-pack`: 定义由 Expert、Skill、Connector、Workflow、Knowledge 与场景组合而成的可安装能力包及其生命周期。

### Modified Capabilities

- `game-studio-scenes`: 游戏场景发现与提示优先由启用的 `game-studio` 能力包提供，并保留 legacy 兼容映射。

## Impact

- 新增 `src/lib/capability-pack-*.js`、`src/packs/` 与 `tests/capability-pack.test.js`
- 修改 `src/main.js`、`src/preload.js`、Agent 空状态与场景路由
- 用户数据新增 `%APPDATA%\KnowMe\capability-packs\`
- 不新增第三方依赖，不改变既有 Capability Hub IPC
