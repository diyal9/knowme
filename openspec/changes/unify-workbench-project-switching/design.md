# Design

## Interaction model

工作台顶部项目切换器只负责选择当前 `activeProjectId`；左侧项目空间负责项目接入、设置、文件浏览和成果归档。两者共享同一 store 状态，不产生第二个项目选择源。

## Scope semantics

- `activeProjectId` 决定新建任务的默认项目与页面的默认筛选。
- “当前项目 / 全部项目”只改变历史列表的查看范围。
- 既有任务继续使用自己持久化的 `projectId`，不因全局切换而重定向。

## Project management

左侧项目菜单统一承载本地目录接入、Git 仓库接入跳转、轻量项目管理与文件动作。管理面板复用已有 Project IPC 完成改名、说明、KnowMe 归档目录、重新定位和归档，不直接修改或删除用户文件。项目栏主体不再重复展示当前项目卡片，而是在“项目文件 / KnowMe 归档”之间切换；归档视图读取项目 `outputPolicy.deliverablesDir` 并补充当前项目的 Agent/工作流成果引用。

## Compatibility

管线历史仅读取明确的 KnowMe 项目绑定字段，不把 Daemon 远程工作区标识误当成产品 `projectId`。旧的未绑定记录仍可在“全部项目”中查看。
