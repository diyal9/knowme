# Design

## 1. 聚合边界

Project 是业务聚合根，保存名称、状态、主要工作来源、参考来源和策略；Content Source 继续描述本地目录、Git 仓库或外部来源。Project 只保存引用和配置，不复制用户文件正文。

一个 V1 Project 必须拥有且仅拥有一个 `workspaceSourceId`。该来源是默认可写根；`referenceSourceIds` 默认只读。相同工作来源只对应一个活动项目，重复打开时返回已有项目。

## 2. Electron 边界

- 主进程：Project Store、迁移、路径/权限解析和生命周期校验，是 Project Context 的事实源。
- IPC：仅传递 Project DTO 和显式 `projectId`，不把主进程绝对路径拼接职责下放到 Renderer。
- preload/shared：提供稳定类型与窄 API。
- Renderer：保存 `activeProjectId` 作为导航状态，并以 Project 派生现有活动来源；不得用它覆盖已存在实体的项目归属。

## 3. 归属与运行快照

`activeProjectId` 只作为新建默认值和列表过滤。Session 可以无项目；涉及项目文件的 Task、Run 和持久化 Artifact 必须绑定项目。运行启动时保存项目、工作来源、仓库 ref/commit 与输出策略快照。

后台路径解析优先使用实体自身的 `projectId`。旧的 `resolveActiveRepo()` 在迁移期仅作为无显式项目的兼容入口；新代码使用 `resolveProjectRepo(projectId)` 或从 task/run/artifact 反查项目。

## 4. 模块兼容

- 伙伴：Profile 全局复用；Session 可选绑定项目，产生文件前必须确定项目。
- 工作台：文件型 Task 必须绑定项目；历史列表可按当前项目或全部项目筛选。
- 能力中心：能力全局存在，声明 `none/optional/required` 项目要求和 read/write 权限。
- 自动化：定义全局存在，绑定和每次运行记录项目；项目不可用时进入 needs-attention。
- Brain：全局存储，Node/Claim/Evidence 以 scope/projectId 形成项目视角；证据按自身项目打开。

## 5. 文件与成果

已有文件原地修改；新正式交付物默认进入项目 `outputs/`（可配置）。智能视图“本次任务”和“最近成果”只投影 Artifact，不创建重复物理文件。运行日志和短期缓存不作为项目文件展示。

Artifact 保存 `projectId/sourceId/relativePath/origin`。任何路径必须在主进程中相对项目工作根解析并执行越界检查。

## 6. 生命周期与迁移

Project 状态为 `active | archived | missing | readonly`。归档只隐藏并暂停新运行，不删除用户文件、历史任务或 Brain 记录。工作根丢失后允许重新定位且保持 Project ID。

首次读取 Project Store 时，为现有本地/Git 来源创建确定性兼容项目并沿用活动来源推导活动项目。旧实体仅在存在可靠 source/path 证据时回填；否则保持未归属。现有 daemon `workspace.projectId` 代表远程仓库标识，迁移为 `repositoryRef` 语义，避免与产品级 ID 冲突。

## 7. 性能

Project Store 使用有界 JSON 元数据，不扫描工作目录。文件树仍由用户展开/刷新时懒加载。启动时只读取 Project/Source 索引；最近成果使用任务/Artifact 索引，不遍历项目目录。

